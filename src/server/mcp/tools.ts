/**
 * MCP tool registrations for delegating work to Antigravity (Cascade).
 *
 * Tool surface (see docs/mcp_server_design.md):
 *   ag_fast_quick_ask   — stateless single-shot model call
 *   ag_quick_ask        — throw-away Cascade, blocks until idle, returns summary
 *   ag_start_task       — fire-and-forget Cascade, returns cascadeId immediately
 *   get_running_cascade — list tracked cascades + status
 *   ag_check_task       — refresh + summarize a tracked cascade by id
 *   ag_send_message     — push a follow-up message to a tracked cascade
 *   delete_cascade      — cancel + dispose + drop a tracked cascade
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AntigravityClient } from "../../core/client.js";
import { Model, ModelOrAlias } from "../../gen/exa/codeium_common_pb/codeium_common_pb.js";
import { CodeAcknowledgementScope, CascadeConfig, CascadePlannerConfig } from "../../gen/exa/cortex_pb/cortex_pb.js";
import { toRunStatus } from "../../types/index.js";
import type { CascadeRegistry } from "./registry.js";
import { summarizeTrajectory, renderTranscript, extractResponseText } from "./summarize.js";
import { renderUnifiedDiff, reconstructRejecting } from "./diff.js";

const DEFAULT_TIMEOUT_MS = 180_000;

type ToolResult = {
    content: { type: "text"; text: string }[];
    isError?: boolean;
};

const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
const fail = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });
const json = (obj: unknown): ToolResult => ok(JSON.stringify(obj, null, 2));

function deriveTitle(prompt: string): string {
    const oneLine = prompt.replace(/\s+/g, " ").trim();
    return oneLine.length > 70 ? oneLine.slice(0, 70) + "…" : oneLine;
}

/** Index of the most recent `userInput` step (= start of the latest turn). */
function latestUserInputIndex(steps: any[]): number {
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i]?.step?.case === "userInput") return i;
    }
    return Math.max(0, steps.length - 1);
}

/** RevertToCascadeStep requires a model; build an override config carrying one. */
function overrideConfigWithModel(modelId: number): CascadeConfig {
    return new CascadeConfig({
        plannerConfig: new CascadePlannerConfig({
            requestedModel: new ModelOrAlias({ choice: { case: "model", value: modelId } }),
        }),
    });
}

/**
 * Resolves a model name to a numeric model id, picking a sensible default from
 * the live catalog when no name is given.
 *
 * We don't rely on the core resolver's hard-coded default (it pins an old
 * `Gemini_3_Flash` label that newer LS catalogs have renamed, and an
 * unspecified model makes `getModelResponse` 404). Instead we choose from
 * `getAvailableModels()` at runtime: prefer a cheap Flash variant, then any
 * recommended model, then any enabled model. The default id is cached.
 */
let _defaultModelId: number | undefined;
async function resolveModelId(client: AntigravityClient, name?: string): Promise<number> {
    if (name) return client.resolveModelId(name);
    if (_defaultModelId !== undefined) return _defaultModelId;

    const models = Object.values(await client.getAvailableModels());
    const enabled = (m: (typeof models)[number]) => !m.disabled && m.modelId !== undefined;
    const pick =
        models.find((m) => enabled(m) && /flash/i.test(m.label)) ??
        models.find((m) => enabled(m) && m.isRecommended) ??
        models.find(enabled);
    if (!pick || pick.modelId === undefined) {
        throw new Error("no usable model found in the LS catalog");
    }
    _defaultModelId = pick.modelId;
    return _defaultModelId;
}

export function registerTools(
    server: McpServer,
    client: AntigravityClient,
    registry: CascadeRegistry,
): void {
    // ── ag_fast_quick_ask ──────────────────────────────────────────────
    server.registerTool(
        "ag_fast_quick_ask",
        {
            title: "Antigravity: fast quick ask (stateless)",
            description:
                "Single-shot, stateless model call via Antigravity. No tools, no repo " +
                "context, no memory, no follow-up. Use for quick opinions, simple " +
                "transforms, or lightweight reasoning you don't want to spend main-context " +
                "tokens on. Returns the answer text directly.",
            inputSchema: {
                prompt: z.string().describe("The prompt to send to the model."),
                model: z
                    .string()
                    .optional()
                    .describe("Optional model name, e.g. 'Gemini_3_Flash'. Defaults to the LS default."),
            },
        },
        async ({ prompt, model }): Promise<ToolResult> => {
            try {
                const modelId = (await resolveModelId(client, model)) as Model;
                const res = await client.getModelResponse(prompt, modelId);
                return ok(res || "(empty response)");
            } catch (e: any) {
                return fail(`ag_fast_quick_ask failed: ${e?.message ?? e}`);
            }
        },
    );

    // ── ag_quick_ask ───────────────────────────────────────────────────
    server.registerTool(
        "ag_quick_ask",
        {
            title: "Antigravity: quick ask (throw-away Cascade)",
            description:
                "Spin up a throw-away Cascade sub-agent (full tools: search, file reads, " +
                "commands), run it to completion, return a concise natural-language summary, " +
                "then dispose it. Best for short investigations / lookups whose raw trace you " +
                "don't want in your context. Blocks until the task is idle (bounded by timeoutMs).",
            inputSchema: {
                prompt: z.string().describe("The task / question for the sub-agent."),
                focus: z
                    .string()
                    .optional()
                    .describe("What you want extracted from the result; folded into the summary."),
                workspacePath: z
                    .string()
                    .optional()
                    .describe("Absolute path to a workspace the sub-agent should be able to search/read."),
                model: z.string().optional().describe("Optional model name for the sub-agent."),
                timeoutMs: z
                    .number()
                    .optional()
                    .describe(`Max wait before giving up and cancelling. Default ${DEFAULT_TIMEOUT_MS}.`),
                fullData: z
                    .boolean()
                    .optional()
                    .describe("If true, return the full rendered transcript instead of an LLM summary."),
            },
        },
        async ({ prompt, focus, workspacePath, model, timeoutMs, fullData }): Promise<ToolResult> => {
            const cascade = await client.startCascade();
            try {
                if (workspacePath) await client.addTrackedWorkspace(workspacePath);
                const modelId = await resolveModelId(client, model);
                const result = await cascade.run(prompt, { model: modelId, timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS });
                if (result.timedOut) {
                    try {
                        await cascade.cancel();
                    } catch {
                        /* ignore */
                    }
                }

                if (fullData) {
                    return ok(
                        `status: ${result.finalStatus}${result.timedOut ? " (timed out)" : ""}\n\n` +
                            renderTranscript(cascade),
                    );
                }

                const summary = await summarizeTrajectory(client, cascade, focus, modelId as Model);
                const note = result.timedOut ? "\n\n[note: task timed out and was cancelled]" : "";
                return ok(summary + note);
            } catch (e: any) {
                return fail(`ag_quick_ask failed: ${e?.message ?? e}`);
            } finally {
                cascade.dispose();
            }
        },
    );

    // ── ag_start_task ──────────────────────────────────────────────────
    server.registerTool(
        "ag_start_task",
        {
            title: "Antigravity: start background task",
            description:
                "Start a long-running Cascade sub-agent and return its cascadeId IMMEDIATELY " +
                "without waiting. Use for heavy/parallel work you want to run while you keep " +
                "going. Poll progress later with ag_check_task, steer it with ag_send_message, " +
                "and free it with delete_cascade.",
            inputSchema: {
                prompt: z.string().describe("The task for the sub-agent."),
                workspacePath: z
                    .string()
                    .optional()
                    .describe("Absolute path to a workspace the sub-agent should be able to search/read."),
                model: z.string().optional().describe("Optional model name for the sub-agent."),
                title: z.string().optional().describe("Short label for tracking (defaults to the prompt)."),
            },
        },
        async ({ prompt, workspacePath, model, title }): Promise<ToolResult> => {
            try {
                const cascade = await client.startCascade();
                if (workspacePath) await client.addTrackedWorkspace(workspacePath);
                const modelId = await resolveModelId(client, model);
                // Fire-and-forget: returns after the RPC ack; does NOT wait for idle.
                await cascade.sendMessage(prompt, { model: modelId });
                const entry = registry.add(cascade, title ?? deriveTitle(prompt));
                return json({ cascadeId: cascade.cascadeId, title: entry.title, status: "started" });
            } catch (e: any) {
                return fail(`ag_start_task failed: ${e?.message ?? e}`);
            }
        },
    );

    // ── get_running_cascade ────────────────────────────────────────────
    server.registerTool(
        "get_running_cascade",
        {
            title: "Antigravity: list tracked cascades",
            description:
                "List every Cascade this server is tracking, with its status (idle/running/…), " +
                "age, and idle time. Use to discover cascadeIds you can check, message, or delete.",
            inputSchema: {},
        },
        async (): Promise<ToolResult> => {
            try {
                return json(registry.list());
            } catch (e: any) {
                return fail(`get_running_cascade failed: ${e?.message ?? e}`);
            }
        },
    );

    // ── ag_check_task ──────────────────────────────────────────────────
    server.registerTool(
        "ag_check_task",
        {
            title: "Antigravity: check task",
            description:
                "Fetch the latest history of a tracked cascade by id, report whether it is " +
                "idle or still running, and return a natural-language summary of its work so " +
                "far (focused by `focus`).\n" +
                "Output modes (priority): rawText > fullData > summary.\n" +
                "- rawText:true → the assistant's text response(s) verbatim, no summarization.\n" +
                "- fullData:true → the full rendered transcript (thinking + tool steps).\n" +
                "- sinceLastMessage:true → scope output to the latest turn only (steps since " +
                "the last message you sent). Combines with any mode.",
            inputSchema: {
                cascadeId: z.string().describe("The cascadeId returned by ag_start_task."),
                focus: z
                    .string()
                    .optional()
                    .describe("What to emphasize in the summary (your current question for it)."),
                sinceLastMessage: z
                    .boolean()
                    .optional()
                    .describe(
                        "If true, only include steps from the most recent message you sent " +
                            "(the latest turn), instead of the whole conversation.",
                    ),
                rawText: z
                    .boolean()
                    .optional()
                    .describe(
                        "If true, return the assistant's text response(s) verbatim without " +
                            "LLM summarization.",
                    ),
                fullData: z
                    .boolean()
                    .optional()
                    .describe("If true, return the full rendered transcript instead of an LLM summary."),
            },
        },
        async ({ cascadeId, focus, sinceLastMessage, rawText, fullData }): Promise<ToolResult> => {
            try {
                const entry = await registry.resolve(cascadeId);
                registry.touch(cascadeId);
                await entry.cascade.getHistory(); // refresh state.trajectory from the LS
                const status = toRunStatus(entry.cascade.state.status);
                const scope = { sinceLastMessage };

                if (rawText) {
                    const text = extractResponseText(entry.cascade, scope);
                    return ok(`status: ${status}\n\n${text || "(no text response yet)"}`);
                }
                if (fullData) {
                    return ok(`status: ${status}\n\n${renderTranscript(entry.cascade, scope)}`);
                }
                const summaryModel = (await resolveModelId(client)) as Model;
                const summary = await summarizeTrajectory(client, entry.cascade, focus, summaryModel, scope);
                return ok(`status: ${status}\n\n${summary}`);
            } catch (e: any) {
                return fail(`ag_check_task failed for "${cascadeId}": ${e?.message ?? e}`);
            }
        },
    );

    // ── ag_send_message ────────────────────────────────────────────────
    server.registerTool(
        "ag_send_message",
        {
            title: "Antigravity: send message to task",
            description:
                "Send a follow-up instruction / feedback to a tracked cascade. Non-blocking by " +
                "default (returns once the message is accepted). Set wait:true to block until " +
                "the turn completes and return the response text.",
            inputSchema: {
                cascadeId: z.string().describe("The cascadeId to send to."),
                message: z.string().describe("The follow-up message."),
                wait: z
                    .boolean()
                    .optional()
                    .describe("If true, wait for the turn to complete and return its text."),
                timeoutMs: z.number().optional().describe(`Max wait when wait:true. Default ${DEFAULT_TIMEOUT_MS}.`),
                model: z.string().optional().describe("Optional model name for this turn."),
            },
        },
        async ({ cascadeId, message, wait, timeoutMs, model }): Promise<ToolResult> => {
            try {
                const entry = await registry.resolve(cascadeId);
                registry.touch(cascadeId);

                const modelId = await resolveModelId(client, model);
                if (wait) {
                    const r = await entry.cascade.run(message, {
                        model: modelId,
                        timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
                    });
                    return ok((r.text || "(no text)") + (r.timedOut ? "\n[timed out]" : ""));
                }

                await entry.cascade.sendMessage(message, { model: modelId });
                return json({ cascadeId, status: "message_sent" });
            } catch (e: any) {
                return fail(`ag_send_message failed for "${cascadeId}": ${e?.message ?? e}`);
            }
        },
    );

    // ── delete_cascade ─────────────────────────────────────────────────
    server.registerTool(
        "delete_cascade",
        {
            title: "Antigravity: delete (archive) cascade",
            description:
                "Cancel the in-flight turn (if any), release the local update stream, and drop " +
                "the cascade from tracking. Call when a sub-task is finished to free resources. " +
                "Note: this does not delete the cascade on the Language Server side.",
            inputSchema: {
                cascadeId: z.string().describe("The cascadeId to archive."),
            },
        },
        async ({ cascadeId }): Promise<ToolResult> => {
            try {
                const disposed = await registry.remove(cascadeId);
                return json({ cascadeId, disposed });
            } catch (e: any) {
                return fail(`delete_cascade failed for "${cascadeId}": ${e?.message ?? e}`);
            }
        },
    );

    // ── ag_get_turn_diff ───────────────────────────────────────────────
    server.registerTool(
        "ag_get_turn_diff",
        {
            title: "Antigravity: get turn diff",
            description:
                "Return the file changes a tracked cascade made in a turn, as a COMPACT unified " +
                "diff (changed hunks + a few context lines) plus +/- line counts. Token-efficient " +
                "way to review a sub-agent's edits without reading whole files. Defaults to the " +
                "latest turn; pass stepIndex to target a specific turn.",
            inputSchema: {
                cascadeId: z.string().describe("The cascadeId whose edits you want."),
                stepIndex: z
                    .number()
                    .optional()
                    .describe("A step index inside the target turn. Defaults to the latest turn."),
                contextLines: z.number().optional().describe("Context lines around each hunk. Default 3."),
                includeContents: z
                    .boolean()
                    .optional()
                    .describe("If true, return full original+modified contents instead of a computed diff."),
            },
        },
        async ({ cascadeId, stepIndex, contextLines, includeContents }): Promise<ToolResult> => {
            try {
                const entry = await registry.resolve(cascadeId);
                registry.touch(cascadeId);
                await entry.cascade.getHistory();

                const steps = entry.cascade.state.trajectory?.steps ?? [];
                let anchor = stepIndex;
                if (anchor === undefined) {
                    anchor = Math.max(0, steps.length - 1);
                    for (let i = steps.length - 1; i >= 0; i--) {
                        if (steps[i]?.step?.case === "userInput") {
                            anchor = i;
                            break;
                        }
                    }
                }

                const resp = await client.lsClient.getTurnDiff({
                    conversationId: cascadeId,
                    stepIndex: anchor,
                });

                if (!resp.fileDiffs.length) {
                    return ok(`No file changes in this turn (anchor step ${anchor}).`);
                }

                const ctx = contextLines ?? 3;
                const parts: string[] = [];
                for (const e of resp.fileDiffs) {
                    const f = e.value;
                    if (!f) continue;
                    const head = `### ${e.key}  (+${f.additions} -${f.deletions})${f.isArtifactFile ? " [artifact]" : ""}`;
                    if (includeContents) {
                        parts.push(`${head}\n--- original ---\n${f.originalContents}\n--- modified ---\n${f.modifiedContents}`);
                        continue;
                    }
                    const d = renderUnifiedDiff(f.originalContents, f.modifiedContents, ctx);
                    if (d.skipped) {
                        parts.push(`${head}\n(file too large to inline diff; use includeContents:true)`);
                    } else {
                        parts.push(`${head}\n\`\`\`diff\n${d.patch}\n\`\`\``);
                    }
                }

                const summary =
                    `turn diff — steps ${resp.turnStartIndex}…${resp.turnEndIndexExclusive}, ` +
                    `+${resp.totalAdditions}/-${resp.totalDeletions} across ${resp.fileDiffs.length} file(s)`;
                return ok(`${summary}\n\n${parts.join("\n\n")}`);
            } catch (e: any) {
                return fail(`ag_get_turn_diff failed for "${cascadeId}": ${e?.message ?? e}`);
            }
        },
    );

    // ── ag_revert_turn ─────────────────────────────────────────────────
    server.registerTool(
        "ag_revert_turn",
        {
            title: "Antigravity: revert turn (undo edits on disk)",
            description:
                "Undo a cascade turn's edits ON DISK via RevertToCascadeStep. This actually " +
                "rolls the workspace files back (whole-turn granularity). Use after reviewing " +
                "ag_get_turn_diff when you want the changes gone. Defaults to the latest turn.",
            inputSchema: {
                cascadeId: z.string().describe("The cascadeId to revert."),
                stepIndex: z
                    .number()
                    .optional()
                    .describe("A step index inside the turn to revert. Defaults to the latest turn."),
            },
        },
        async ({ cascadeId, stepIndex }): Promise<ToolResult> => {
            try {
                const entry = await registry.resolve(cascadeId);
                registry.touch(cascadeId);
                await entry.cascade.getHistory();
                const steps = entry.cascade.state.trajectory?.steps ?? [];
                const anchor = stepIndex ?? latestUserInputIndex(steps);

                const td = await client.lsClient.getTurnDiff({ conversationId: cascadeId, stepIndex: anchor });
                const target = td.turnStartIndex;
                const modelId = await resolveModelId(client);

                await client.lsClient.revertToCascadeStep({
                    cascadeId,
                    stepIndex: target,
                    overrideConfig: overrideConfigWithModel(modelId),
                });

                return ok(
                    `Reverted cascade ${cascadeId} to step ${target} (undid the turn covering steps ` +
                        `${td.turnStartIndex}…${td.turnEndIndexExclusive}). Workspace files rolled back.`,
                );
            } catch (e: any) {
                return fail(`ag_revert_turn failed for "${cascadeId}": ${e?.message ?? e}`);
            }
        },
    );

    // ── ag_reject_edit ─────────────────────────────────────────────────
    server.registerTool(
        "ag_reject_edit",
        {
            title: "Antigravity: reject edit (file/hunk) with reason",
            description:
                "Reject a cascade's code edit at all/file/hunk granularity and APPLY it to disk, " +
                "then attach a REASON so the sub-agent learns why. Replicates what the IDE does: " +
                "computes the desired post-state (full revert for all/file; partial for hunk via " +
                "reconstructRejecting), writes it with the LS WriteFile RPC, then syncs the " +
                "rejection via AcknowledgeCodeActionStep. For whole-turn rollback (incl. file " +
                "creations) use ag_revert_turn instead.",
            inputSchema: {
                cascadeId: z.string().describe("The cascadeId whose edit you reject."),
                reason: z.string().describe("Why you're rejecting it (sent as writtenFeedback)."),
                scope: z
                    .enum(["all", "file", "hunk"])
                    .optional()
                    .describe("Granularity: all/file revert whole files; hunk reverts selected hunks. Default 'all'."),
                files: z
                    .array(z.string())
                    .optional()
                    .describe("For scope 'file'/'hunk': path substrings selecting the file(s) (default: all changed)."),
                rejectHunks: z
                    .array(z.number())
                    .optional()
                    .describe("For scope 'hunk': 1-based hunk indices to reject (see ag_get_turn_diff)."),
                feedbackOnly: z
                    .boolean()
                    .optional()
                    .describe("If true, only send the rejection feedback to the LS; do NOT touch disk."),
                stepIndex: z.number().optional().describe("Step inside the target turn. Defaults to latest."),
            },
        },
        async ({ cascadeId, reason, scope, files, rejectHunks, feedbackOnly, stepIndex }): Promise<ToolResult> => {
            try {
                const entry = await registry.resolve(cascadeId);
                registry.touch(cascadeId);
                await entry.cascade.getHistory();
                const steps = entry.cascade.state.trajectory?.steps ?? [];
                const anchor = stepIndex ?? latestUserInputIndex(steps);

                const td = await client.lsClient.getTurnDiff({ conversationId: cascadeId, stepIndex: anchor });
                if (!td.fileDiffs.length) {
                    return ok(`No edits to reject in this turn (anchor step ${anchor}).`);
                }

                const sc = scope ?? "all";
                const scopeEnum =
                    sc === "file"
                        ? CodeAcknowledgementScope.FILE
                        : sc === "hunk"
                          ? CodeAcknowledgementScope.HUNK
                          : CodeAcknowledgementScope.ALL;

                let targets = td.fileDiffs;
                if ((sc === "file" || sc === "hunk") && files?.length) {
                    targets = td.fileDiffs.filter((e) => files.some((f) => e.key.includes(f)));
                }
                if (!targets.length) {
                    return ok(`No matching files to reject (filter: ${files?.join(", ") ?? "—"}).`);
                }

                const turnIndices: number[] = [];
                for (let i = td.turnStartIndex; i < td.turnEndIndexExclusive; i++) turnIndices.push(i);

                const enc = new TextEncoder();
                const infos: {
                    uriPath: string;
                    stepIndices: number[];
                    preCodeActionsState: string;
                    postCodeActionsState: string;
                }[] = [];
                const applied: string[] = [];

                for (const e of targets) {
                    const f = e.value!;
                    // Desired post-state: hunk → keep accepted hunks only; all/file → original.
                    const post =
                        sc === "hunk" && rejectHunks?.length
                            ? reconstructRejecting(f.originalContents, f.modifiedContents, rejectHunks).contents
                            : f.originalContents;

                    if (!feedbackOnly) {
                        // Replicate the IDE extension's write-back to disk.
                        await client.lsClient.writeFile({
                            uri: e.key,
                            content: enc.encode(post),
                            overwrite: true,
                        });
                        applied.push(e.key);
                    }
                    infos.push({
                        uriPath: e.key,
                        stepIndices: turnIndices,
                        preCodeActionsState: f.originalContents,
                        postCodeActionsState: post,
                    });
                }

                // Sync the rejection (+ reason) to the LS so the sub-agent learns.
                await client.lsClient.acknowledgeCodeActionStep({
                    cascadeId,
                    accept: false,
                    writtenFeedback: reason,
                    acknowledgementScope: scopeEnum,
                    codeAcknowledgementRequestInfos: infos,
                });

                const diskNote = feedbackOnly
                    ? " (feedbackOnly: disk not changed)"
                    : ` Applied to disk on ${applied.length} file(s).`;
                return ok(`Rejected ${sc}-scope edit with feedback.${diskNote}`);
            } catch (e: any) {
                return fail(`ag_reject_edit failed for "${cascadeId}": ${e?.message ?? e}`);
            }
        },
    );
}
