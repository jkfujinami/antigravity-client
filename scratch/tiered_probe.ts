/**
 * Investigate the "*-tiered" models (no displayName in GetAvailableModels, e.g.
 * gemini-3.7-flash-tiered = PLACEHOLDER_M301). Hypothesis: it's a meta-model
 * that auto-routes to one of the concrete high/medium/low tiers server-side.
 * Cascade's step metadata.model_usage.model reveals which model actually served
 * the request (unlike GetModelResponse, which returns only plain text).
 */
import { AntigravityClient } from "../src/index.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

const TIERED_ID = 1301; // gemini-3.7-flash-tiered (PLACEHOLDER_M301)
const RUNS = 3;

async function main() {
    const client = await AntigravityClient.connect();

    for (let i = 0; i < RUNS; i++) {
        const cascade = await client.startCascade();
        try {
            const result = await cascade.run(`Reply with only the word OK. (run ${i})`, {
                model: TIERED_ID,
                timeoutMs: 30_000,
            });
            console.log(`\n--- run ${i} --- text=${JSON.stringify(result.text)}`);
            for (const s of cascade.state.trajectory?.steps ?? []) {
                const mu = (s as any).metadata?.modelUsage;
                if (!mu) continue;
                console.log(`  model_usage.model=${mu.model} (${Model[mu.model] || "?"}) in=${mu.inputTokens} out=${mu.outputTokens}`);
            }
        } catch (e: any) {
            console.error(`run ${i} failed:`, e?.message || e);
        } finally {
            await cascade.cancel().catch(() => {});
        }
    }

    client.dispose();
}

main().catch((e) => {
    console.error("fatal:", e);
    process.exit(1);
});
