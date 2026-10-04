/**
 * Test whether Cascade (not just GetModelResponse) can be forced onto a model
 * that isn't in the curated cascadeModelConfigData list (e.g. gemini-3.1-flash-lite
 * = PLACEHOLDER_M50 = 1050), by passing a raw numeric model id to sendMessage().
 */
import { AntigravityClient } from "../src/index.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

const TARGET_MODEL_ID = 1050; // PLACEHOLDER_M50 = gemini-3.1-flash-lite

async function main() {
    const client = await AntigravityClient.connect();
    const cascade = await client.startCascade();

    try {
        const result = await cascade.run("Reply with only the word OK.", {
            model: TARGET_MODEL_ID,
            timeoutMs: 30_000,
        });

        console.log("Response text:", JSON.stringify(result.text));
        console.log("\nSteps / model actually used:");
        for (const s of cascade.state.trajectory?.steps ?? []) {
            const mu = (s as any).metadata?.modelUsage;
            if (!mu) continue;
            console.log(
                `  stepType=${(s as any).stepType} model=${mu.model} (${Model[mu.model]}) in=${mu.inputTokens} out=${mu.outputTokens}`
            );
        }
    } catch (e: any) {
        console.error("run() failed:", e?.message || e);
    } finally {
        await cascade.cancel().catch(() => {});
        client.dispose();
    }
}

main().catch((e) => {
    console.error("fatal:", e);
    process.exit(1);
});
