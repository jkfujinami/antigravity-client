/**
 * Actually call GetModelResponse for every model GetAvailableModels currently
 * advertises (33 entries, captured live) to see which ones actually respond.
 */
import { AntigravityClient } from "../src/index.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

const ALL_33: [key: string, enumName: keyof typeof Model][] = [
    ["gpt-oss-120b-medium", "OPENAI_GPT_OSS_120B_MEDIUM"],
    ["gemini-3.6-flash-low", "PLACEHOLDER_M73"],
    ["gemini-3.7-flash-medium", "PLACEHOLDER_M299"],
    ["tab_flash_lite_preview", "PLACEHOLDER_M19"],
    ["gemini-3.1-flash-image", "PLACEHOLDER_M21"],
    ["gemini-3.8-flash-medium", "PLACEHOLDER_M319"],
    ["claude-opus-4-6-thinking", "PLACEHOLDER_M26"],
    ["gemini-2.5-flash", "GOOGLE_GEMINI_2_5_FLASH"],
    ["chat_20706", "CHAT_20706"],
    ["gemini-3.8-flash-low", "PLACEHOLDER_M320"],
    ["gemini-2.5-pro", "GOOGLE_GEMINI_2_5_PRO"],
    ["gemini-3-flash-agent", "PLACEHOLDER_M84"],
    ["gemini-2.5-flash-thinking", "GOOGLE_GEMINI_2_5_FLASH_THINKING"],
    ["gemini-3.1-flash-lite", "PLACEHOLDER_M50"],
    ["gemini-pro-agent", "PLACEHOLDER_M16"],
    ["tab_jump_flash_lite_preview", "PLACEHOLDER_M28"],
    ["gemini-3.5-flash-extra-low", "PLACEHOLDER_M187"],
    ["gemini-3.6-flash-high", "PLACEHOLDER_M71"],
    ["gemini-3.7-flash-low", "PLACEHOLDER_M300"],
    ["claude-sonnet-4-6", "PLACEHOLDER_M35"],
    ["gemini-3.7-flash-tiered", "PLACEHOLDER_M301"],
    ["gemini-3-flash", "PLACEHOLDER_M18"],
    ["gemini-3.7-flash-high", "PLACEHOLDER_M298"],
    ["gemini-3.1-pro-low", "PLACEHOLDER_M36"],
    ["chat_23310", "CHAT_23310"],
    ["gemini-3.5-flash-lite", "PLACEHOLDER_M198"],
    ["gemini-3.8-flash-high", "PLACEHOLDER_M318"],
    ["gemini-2.5-flash-lite", "GOOGLE_GEMINI_2_5_FLASH_LITE"],
    ["gemini-3.5-flash-low", "PLACEHOLDER_M20"],
    ["gemini-3.6-flash-medium", "PLACEHOLDER_M72"],
    ["gemini-3.6-flash-tiered", "PLACEHOLDER_M196"],
    ["gemini-3.1-pro-high", "PLACEHOLDER_M37"],
    ["gemini-3.8-flash-tiered", "PLACEHOLDER_M322"],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const client = await AntigravityClient.connect();
    const results: { key: string; enumName: string; ok: boolean; ms: number; detail: string }[] = [];

    for (const [key, enumName] of ALL_33) {
        const id = Model[enumName];
        const start = Date.now();
        try {
            const res = await client.getModelResponse("Reply with only the word OK.", id);
            const ms = Date.now() - start;
            results.push({ key, enumName, ok: true, ms, detail: JSON.stringify(res).slice(0, 100) });
            console.log(`✅ ${key} (${enumName}=${id}) [${ms}ms] -> ${JSON.stringify(res).slice(0, 100)}`);
        } catch (e: any) {
            const ms = Date.now() - start;
            const msg = e?.message || String(e);
            results.push({ key, enumName, ok: false, ms, detail: msg });
            console.log(`❌ ${key} (${enumName}=${id}) [${ms}ms] -> ${msg}`);
        }
        await sleep(250);
    }

    const okCount = results.filter((r) => r.ok).length;
    console.log(`\n=== Summary: ${okCount}/${results.length} succeeded ===`);
    results.filter((r) => !r.ok).forEach((r) => console.log(`  FAIL ${r.key}: ${r.detail}`));

    client.dispose();
}

main().catch((e) => {
    console.error("probe failed:", e);
    process.exit(1);
});
