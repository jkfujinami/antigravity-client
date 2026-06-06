/**
 * Probe: does the LS actually revert disk state when we reject a cascade's code
 * edit, and/or when we revert to a step? Resolves the open design question for
 * ag_reject_edit / ag_revert_turn before wiring them into the MCP server.
 *
 * Run: npx tsx test/test_reject_revert.ts
 */
import * as fs from "fs";
import * as path from "path";
import { AntigravityClient } from "../src/index.js";
import { CodeAcknowledgementScope, CascadeConfig, CascadePlannerConfig } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { ModelOrAlias } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import { renderUnifiedDiff, reconstructRejecting } from "../src/server/mcp/diff.js";

const SCRATCH = "reject_probe_scratch.ts";

async function pickModelId(client: AntigravityClient): Promise<number> {
    const models = Object.values(await client.getAvailableModels());
    const enabled = (m: any) => !m.disabled && m.modelId !== undefined;
    const pick =
        models.find((m) => enabled(m) && /flash/i.test(m.label)) ??
        models.find((m) => enabled(m) && m.isRecommended) ??
        models.find(enabled);
    if (!pick) throw new Error("no model");
    console.log(`[model] using ${pick.label} (id ${pick.modelId})`);
    return pick.modelId!;
}

function readScratch(ws: string): string {
    const p = path.join(ws, SCRATCH);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "<missing>";
}

function latestUserInput(steps: any[]): number {
    for (let i = steps.length - 1; i >= 0; i--) if (steps[i]?.step?.case === "userInput") return i;
    return Math.max(0, steps.length - 1);
}

async function main() {
    // Use the repo as workspace (known-good edit path); scratch file at repo root.
    const ws = process.cwd();
    console.log(`[ws] ${ws}`);

    const client = await AntigravityClient.launch({ workspacePath: ws });
    try {
        const model = await pickModelId(client);
        const cascade = await client.startCascade();
        console.log(`[cascade] ${cascade.cascadeId}`);

        // Turn 1: create the file
        console.log("\n=== turn 1: create ===");
        await cascade.run(
            `Create a file named ${SCRATCH} containing exactly:\n` +
                `export const A = 1;\nexport const B = 2;\nexport const C = 3;\n`,
            { model, timeoutMs: 90000 },
        );
        console.log("disk after create:\n" + readScratch(ws));

        // Turn 2: modify two separate places
        console.log("\n=== turn 2: modify ===");
        const r2 = await cascade.run(
            `In ${SCRATCH}, change "export const A = 1;" to "export const A = 100;" and change ` +
                `"export const C = 3;" to "export const C = 300;". Leave B untouched.`,
            { model, timeoutMs: 90000 },
        );
        console.log(`[turn2] finalStatus=${r2.finalStatus} timedOut=${r2.timedOut} newSteps=${r2.newSteps.length} text="${r2.text.slice(0, 120)}"`);
        const afterModify = readScratch(ws);
        console.log("disk after modify:\n" + afterModify);

        // Pull the turn diff
        await cascade.getHistory();
        const steps = cascade.state.trajectory?.steps ?? [];
        const anchor = latestUserInput(steps);
        const td = await client.lsClient.getTurnDiff({ conversationId: cascade.cascadeId, stepIndex: anchor });
        console.log(`\n[turnDiff] anchor=${anchor} range ${td.turnStartIndex}..${td.turnEndIndexExclusive}, files=${td.fileDiffs.length}, +${td.totalAdditions}/-${td.totalDeletions}`);
        for (const e of td.fileDiffs) {
            const f = e.value!;
            const r = renderUnifiedDiff(f.originalContents, f.modifiedContents, 1);
            console.log(`\nfile: ${e.key} (hunks=${r.hunkCount})\n${r.patch}`);
        }

        // Build request infos from the turn diff
        const turnIndices: number[] = [];
        for (let i = td.turnStartIndex; i < td.turnEndIndexExclusive; i++) turnIndices.push(i);

        // ── PROBE A: reject ALL with reason ──
        console.log("\n=== PROBE A: acknowledgeCodeActionStep(accept=false, scope=ALL) ===");
        const infosAll = td.fileDiffs.map((e) => ({
            uriPath: e.key,
            stepIndices: turnIndices,
            preCodeActionsState: e.value!.originalContents,
            postCodeActionsState: e.value!.originalContents, // reject-all → revert to original
        }));
        try {
            await client.lsClient.acknowledgeCodeActionStep({
                cascadeId: cascade.cascadeId,
                accept: false,
                writtenFeedback: "Probe: rejecting all edits, revert to original.",
                acknowledgementScope: CodeAcknowledgementScope.ALL,
                codeAcknowledgementRequestInfos: infosAll,
            });
            console.log("acknowledgeCodeActionStep OK");
        } catch (e: any) {
            console.log("acknowledgeCodeActionStep ERROR:", e?.message ?? e);
        }
        await new Promise((r) => setTimeout(r, 1500));
        const afterRejectAll = readScratch(ws);
        console.log("disk after reject-ALL:\n" + afterRejectAll);
        console.log(afterRejectAll.includes("A = 100") ? ">> disk NOT reverted by ack" : ">> disk REVERTED by ack");

        // ── PROBE B: revertToCascadeStep ──
        console.log("\n=== PROBE B: revertToCascadeStep(turnStart) ===");
        try {
            await client.lsClient.revertToCascadeStep({
                cascadeId: cascade.cascadeId,
                stepIndex: td.turnStartIndex,
                overrideConfig: new CascadeConfig({
                    plannerConfig: new CascadePlannerConfig({
                        requestedModel: new ModelOrAlias({ choice: { case: "model", value: model } }),
                    }),
                }),
            });
            console.log("revertToCascadeStep OK");
        } catch (e: any) {
            console.log("revertToCascadeStep ERROR:", e?.message ?? e);
        }
        await new Promise((r) => setTimeout(r, 1500));
        const afterRevert = readScratch(ws);
        console.log("disk after revertToStep:\n" + afterRevert);
        console.log(afterRevert.includes("A = 100") ? ">> disk NOT reverted by revert" : ">> disk REVERTED by revert");

        // ── PROBE C: hunk-level reconstruction sanity (local only) ──
        console.log("\n=== PROBE C: local hunk reconstruction ===");
        for (const e of td.fileDiffs) {
            const f = e.value!;
            const r = renderUnifiedDiff(f.originalContents, f.modifiedContents, 1);
            console.log(`file ${e.key}: hunks=${r.hunkCount}`);
            if (r.hunkCount >= 2) {
                const keepOne = reconstructRejecting(f.originalContents, f.modifiedContents, [2], 1);
                console.log("reject hunk 2 only →\n" + keepOne.contents);
            }
        }

        cascade.dispose();
    } finally {
        client.dispose();
        await client.launcher.stop();
        // ws is the repo — only remove the scratch file, never the workspace.
        try {
            fs.rmSync(path.join(ws, SCRATCH), { force: true });
        } catch {}
        console.log("\n[done] cleaned up scratch file");
    }
}

main().catch((e) => {
    console.error("FATAL", e);
    process.exit(1);
});
