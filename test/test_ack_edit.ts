/**
 * Probe: can AcknowledgeCascadeCodeEdit(absoluteUri[], contents[], accept) set
 * arbitrary per-file disk contents? If so it backs FILE/HUNK-granular rejection
 * (write the partially-applied post-state to disk). Decisive single test:
 * send a PARTIAL post-state (revert A's change, keep C's change) and see what
 * lands on disk.
 *
 * Run: npx tsx test/test_ack_edit.ts
 */
import * as fs from "fs";
import * as path from "path";
import { AntigravityClient } from "../src/index.js";

const SCRATCH = "ack_edit_scratch.ts";

async function pickModelId(client: AntigravityClient): Promise<number> {
    const models = Object.values(await client.getAvailableModels());
    const enabled = (m: any) => !m.disabled && m.modelId !== undefined;
    const pick =
        models.find((m) => enabled(m) && /flash/i.test(m.label)) ??
        models.find((m) => enabled(m) && m.isRecommended) ??
        models.find(enabled);
    if (!pick) throw new Error("no model");
    return pick.modelId!;
}

const read = (ws: string) => {
    const p = path.join(ws, SCRATCH);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "<missing>";
};

async function main() {
    const ws = process.cwd();
    const client = await AntigravityClient.launch({ workspacePath: ws });
    try {
        const model = await pickModelId(client);
        const cascade = await client.startCascade();
        console.log(`[cascade] ${cascade.cascadeId}`);

        await cascade.run(
            `Create ${SCRATCH} containing exactly:\nexport const A = 1;\nexport const B = 2;\nexport const C = 3;\n`,
            { model, timeoutMs: 90000 },
        );
        await cascade.run(
            `In ${SCRATCH}, change "A = 1" to "A = 100" and "C = 3" to "C = 300". Leave B as-is.`,
            { model, timeoutMs: 90000 },
        );
        console.log("disk after modify:\n" + read(ws));

        await cascade.getHistory();
        const steps = cascade.state.trajectory?.steps ?? [];
        let anchor = steps.length - 1;
        for (let i = steps.length - 1; i >= 0; i--) if (steps[i]?.step?.case === "userInput") { anchor = i; break; }
        const td = await client.lsClient.getTurnDiff({ conversationId: cascade.cascadeId, stepIndex: anchor });
        const e = td.fileDiffs[0];
        if (!e) {
            console.log("no file diffs; aborting");
            return;
        }
        const uri = e.key;
        const original = e.value!.originalContents;
        // partial post-state: revert A's change, KEEP C's change
        const partial = "export const A = 1;\nexport const B = 2;\nexport const C = 300;\n";
        console.log(`uri=${uri}`);
        console.log("partial post-state we will send:\n" + partial);

        console.log("\n=== AcknowledgeCascadeCodeEdit(accept=false, contents=[partial]) ===");
        try {
            await client.lsClient.acknowledgeCascadeCodeEdit({
                cascadeId: cascade.cascadeId,
                absoluteUri: [uri],
                contents: [partial],
                accept: false,
            });
            console.log("acknowledgeCascadeCodeEdit OK");
        } catch (err: any) {
            console.log("acknowledgeCascadeCodeEdit ERROR:", err?.message ?? err);
        }
        await new Promise((r) => setTimeout(r, 1500));
        const after = read(ws);
        console.log("disk after ack(partial):\n" + after);
        if (after.includes("A = 1;") && after.includes("C = 300")) console.log(">> PARTIAL applied (A reverted, C kept) — granular disk reject WORKS via contents");
        else if (after.includes("A = 100") && after.includes("C = 300")) console.log(">> NO disk change (still modified)");
        else if (after === original) console.log(">> reverted to ORIGINAL (ignored partial contents)");
        else console.log(">> other:\n" + after);

        // Also test accept=true with partial to compare, if needed — skipped.

        cascade.dispose();
    } finally {
        client.dispose();
        await client.launcher.stop();
        try {
            fs.rmSync(path.join(ws, SCRATCH), { force: true });
        } catch {}
        console.log("\n[done] cleaned up");
    }
}

main().catch((e) => {
    console.error("FATAL", e);
    process.exit(1);
});
