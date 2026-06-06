/**
 * Probe: replicate the IDE extension's role — write the desired post-state to
 * disk ourselves via the LS WriteFile RPC, achieving true file/hunk-level edit
 * rejection in standalone. Then sync the rejection via acknowledgeCodeActionStep.
 *
 * Run: npx tsx test/test_writefile_reject.ts
 */
import * as fs from "fs";
import * as path from "path";
import { AntigravityClient } from "../src/index.js";
import { CodeAcknowledgementScope } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { renderUnifiedDiff, reconstructRejecting } from "../src/server/mcp/diff.js";

const SCRATCH = "writefile_reject_scratch.ts";

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
        const e = td.fileDiffs[0]!;
        const uri = e.key;
        const f = e.value!;
        const r = renderUnifiedDiff(f.originalContents, f.modifiedContents, 0);
        console.log(`hunks=${r.hunkCount}\n${r.patch}`);

        // Reject hunk 1 (the A change), keep hunk 2 (C change)
        const post = reconstructRejecting(f.originalContents, f.modifiedContents, [1], 0).contents;
        console.log("computed post-state (reject A, keep C):\n" + post);

        console.log("\n=== WriteFile(post-state) — replicate extension write-back ===");
        try {
            await client.lsClient.writeFile({
                uri,
                content: new TextEncoder().encode(post),
                overwrite: true,
            });
            console.log("writeFile OK");
        } catch (err: any) {
            console.log("writeFile ERROR:", err?.message ?? err);
        }
        await new Promise((r) => setTimeout(r, 800));
        const after = read(ws);
        console.log("disk after writeFile:\n" + after);
        const ok = after.includes("A = 1;") && after.includes("C = 300");
        console.log(ok ? ">> SUCCESS: hunk-level reject applied to disk" : ">> FAIL: disk not as expected");

        // Sync rejection feedback to the LS
        console.log("\n=== acknowledgeCodeActionStep(reject, HUNK) for metadata sync ===");
        try {
            await client.lsClient.acknowledgeCodeActionStep({
                cascadeId: cascade.cascadeId,
                accept: false,
                writtenFeedback: "Rejected the A change; kept C.",
                acknowledgementScope: CodeAcknowledgementScope.HUNK,
                codeAcknowledgementRequestInfos: [
                    { uriPath: uri, stepIndices: [], preCodeActionsState: f.originalContents, postCodeActionsState: post },
                ],
            });
            console.log("acknowledge OK");
        } catch (err: any) {
            console.log("acknowledge ERROR:", err?.message ?? err);
        }

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
