/**
 * Probe: try GetModelResponse with a handful of Model enum values that do NOT
 * appear in the live cascadeModelConfigData list, to see whether the one-shot
 * endpoint can reach models Cascade doesn't currently surface.
 * Uses a tiny prompt to keep quota usage minimal.
 */
import { AntigravityClient } from "../src/index.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

const CANDIDATES: (keyof typeof Model)[] = [
    // known-live via named enum (not placeholder) — sanity check baseline
    "OPENAI_GPT_OSS_120B_MEDIUM",
    // superseded/legacy named models not in current cascade list
    "GOOGLE_GEMINI_2_5_PRO",
    "CLAUDE_4_OPUS",
    "CLAUDE_4_SONNET",
    // internal/experimental codenames
    "GOOGLE_JARVIS_PROXY",
    "GOOGLE_GEMINI_RIFTRUNNER",
    "GOOGLE_GEMINI_COMPUTER_USE_EXPERIMENTAL",
    // ancient numeric "CHAT_" legacy id
    "CHAT_20706",
    // a placeholder slot NOT in the live 14 (to see if server responds at all)
    "PLACEHOLDER_M1",
];

async function main() {
    const client = await AntigravityClient.connect();

    for (const name of CANDIDATES) {
        const id = Model[name];
        const start = Date.now();
        try {
            const res = await client.getModelResponse("Reply with only the word OK.", id);
            const ms = Date.now() - start;
            console.log(`✅ ${name} (${id}) [${ms}ms] -> ${JSON.stringify(res).slice(0, 120)}`);
        } catch (e: any) {
            const ms = Date.now() - start;
            console.log(`❌ ${name} (${id}) [${ms}ms] -> ${e?.message || e}`);
        }
    }

    client.dispose();
}

main().catch((e) => {
    console.error("probe failed:", e);
    process.exit(1);
});
