/**
 * Trajectory summarization for the MCP server.
 *
 * The whole point of delegating to a sub-agent is to NOT pour its raw,
 * multi-thousand-step trajectory back into the calling agent's context. So
 * instead of returning the trajectory verbatim, we:
 *   1. render a compact transcript (thinking + assistant text + key tool steps),
 *   2. ask the LS's own model (`getModelResponse`) to re-summarize it in natural
 *      language, folding in the caller's `focus` instruction.
 *
 * `renderTranscript()` is also exposed directly for the `fullData` escape hatch.
 */
import type { AntigravityClient } from "../../core/client.js";
import type { Cascade } from "../../core/cascade/index.js";
import { CascadeStep } from "../../types/index.js";
import { Model } from "../../gen/exa/codeium_common_pb/codeium_common_pb.js";
import type { Step } from "../../gen/exa/gemini_coder/proto/trajectory_pb.js";

/** Hard cap on the transcript fed to the summarizer model (chars). */
const MAX_TRANSCRIPT_CHARS = 60_000;

function truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return s.slice(0, max) + `…[+${s.length - max} chars]`;
}

/** Best-effort extraction of a human-readable string from a step payload. */
function extractText(v: any): string {
    if (!v) return "";
    if (typeof v === "string") return v;
    for (const k of ["text", "query", "prompt", "content", "message"]) {
        if (typeof v[k] === "string" && v[k]) return v[k];
    }
    if (Array.isArray(v.items)) {
        return v.items
            .map((it: any) => it?.chunk?.value ?? it?.text ?? "")
            .filter(Boolean)
            .join(" ");
    }
    return "";
}

export interface ScopeOptions {
    /**
     * When true, only consider steps from the most recent user message onward
     * (i.e. the latest turn). When false/absent, the whole trajectory is used.
     */
    sinceLastMessage?: boolean;
}

/**
 * Returns the steps to consider, optionally narrowed to the latest turn.
 * `offset` is the index in the full trajectory at which the slice starts (so
 * CascadeStep indices stay meaningful).
 */
function scopedSteps(cascade: Cascade, opts: ScopeOptions): { steps: Step[]; offset: number } {
    const steps = cascade.state.trajectory?.steps ?? [];
    if (!opts.sinceLastMessage) return { steps, offset: 0 };

    let lastUser = -1;
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i]?.step?.case === "userInput") {
            lastUser = i;
            break;
        }
    }
    if (lastUser < 0) return { steps, offset: 0 };
    return { steps: steps.slice(lastUser), offset: lastUser };
}

/**
 * Concatenates the assistant's text responses (no summarization), optionally
 * scoped to the latest turn. Returns the raw model-authored prose.
 */
export function extractResponseText(cascade: Cascade, opts: ScopeOptions = {}): string {
    const { steps } = scopedSteps(cascade, opts);
    const parts: string[] = [];
    for (const raw of steps) {
        if (raw?.step?.case !== "plannerResponse") continue;
        const v: any = raw.step.value;
        const text = v?.modifiedResponse || v?.response;
        if (text) parts.push(text);
    }
    return parts.join("\n\n").trim();
}

/**
 * Renders a cascade's trajectory into a compact, readable transcript covering
 * the agent's reasoning, its assistant text, and the salient tool steps.
 * Noisy system/meta steps are dropped. Output is bounded by MAX_TRANSCRIPT_CHARS.
 * Optionally scoped to the latest turn via `opts.sinceLastMessage`.
 */
export function renderTranscript(cascade: Cascade, opts: ScopeOptions = {}): string {
    const { steps, offset } = scopedSteps(cascade, opts);
    const blocks: string[] = [];

    steps.forEach((raw: Step, i: number) => {
        const s = new CascadeStep(raw, offset + i);
        switch (s.category) {
            case "user_input": {
                const text = extractText(s.value);
                if (text) blocks.push(`# USER\n${text}`);
                break;
            }
            case "response": {
                const v: any = s.value;
                const thinking = v?.thinking;
                const response = v?.modifiedResponse || v?.response;
                if (thinking) blocks.push(`# THINKING\n${thinking}`);
                if (response) blocks.push(`# ASSISTANT\n${response}`);
                break;
            }
            case "command": {
                const v: any = s.value;
                const cmd = v?.proposedCommandLine || v?.commandLine;
                if (!cmd) break;
                let block = `# TOOL command\n$ ${cmd}`;
                if (v?.stdout) block += `\n[stdout]\n${truncate(String(v.stdout), 2000)}`;
                if (v?.stderr) block += `\n[stderr]\n${truncate(String(v.stderr), 1000)}`;
                blocks.push(block);
                break;
            }
            case "search":
            case "web":
            case "file_view":
            case "file_write":
            case "file_delete":
            case "file_move":
            case "knowledge":
            case "browser": {
                blocks.push(`# TOOL ${s.type} -> ${s.description}`);
                break;
            }
            default:
                // skip system / other steps to keep the transcript signal-dense
                break;
        }
    });

    let out = blocks.join("\n\n").trim();
    if (out.length > MAX_TRANSCRIPT_CHARS) {
        const headLen = Math.floor(MAX_TRANSCRIPT_CHARS * 0.6);
        const tailLen = MAX_TRANSCRIPT_CHARS - headLen;
        out =
            out.slice(0, headLen) +
            "\n\n…[transcript truncated]…\n\n" +
            out.slice(out.length - tailLen);
    }
    return out;
}

/**
 * Summarizes a cascade's work via the LS model. `focus` carries the calling
 * agent's instruction about what it wants extracted, and is woven into the
 * summarization prompt. Returns natural-language prose.
 */
export async function summarizeTrajectory(
    client: AntigravityClient,
    cascade: Cascade,
    focus?: string,
    summaryModel: Model = Model.UNSPECIFIED,
    opts: ScopeOptions = {},
): Promise<string> {
    const transcript = renderTranscript(cascade, opts);
    if (!transcript.trim()) return "(no activity recorded yet)";

    const focusLine = focus
        ? `The requesting agent specifically asked you to focus on: "${focus}"\n` +
          `Prioritize information relevant to that focus.\n`
        : "";

    const prompt = [
        "You are condensing the work log of a sub-agent for the AI agent that delegated a task to it.",
        focusLine,
        "Summarize the sub-agent's reasoning and — most importantly — its final result or answer, in clear natural language.",
        "Rules:",
        "- Be faithful: never invent facts that are not in the log.",
        "- Be concise, but keep concrete findings (file paths, names, code snippets, conclusions, numbers).",
        "- If the task is unfinished, state the stage it reached and what is still pending.",
        "",
        "=== SUB-AGENT WORK LOG START ===",
        transcript,
        "=== SUB-AGENT WORK LOG END ===",
        "",
        "Now write the summary:",
    ].join("\n");

    return client.getModelResponse(prompt, summaryModel);
}
