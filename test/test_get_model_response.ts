import { AntigravityClient } from "../src/client.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

async function main() {
    try {
        console.log("🔌 Connecting to local Antigravity Language Server...");
        const client = await AntigravityClient.connect();
        console.log("✅ Connected.");

        const prompt = "あなたのモデル名（Gemini等）と、現在のシステム状態について30文字以内で要約してください。";

        // テストするモデル Enum の配列
        const modelsToTest = [
            { name: "Model.CHAT_23310", value: Model.CHAT_23310 },
            { name: "Model.CHAT_20706", value: Model.CHAT_20706 },
            { name: "Model.GOOGLE_GEMINI_2_5_FLASH", value: Model.GOOGLE_GEMINI_2_5_FLASH },
            { name: "Model.GOOGLE_GEMINI_2_5_FLASH_THINKING", value: Model.GOOGLE_GEMINI_2_5_FLASH_THINKING }
        ];

        for (const m of modelsToTest) {
            console.log(`\n💬 Sending stateless prompt using \x1b[36m${m.name}\x1b[0m...`);
            try {
                const response = await client.getModelResponse(prompt, m.value);
                console.log(`🎉 SUCCESS! Model Response:`);
                console.log(`\x1b[32m${response}\x1b[0m\n`);
                return; // 成功したら終了
            } catch (err: any) {
                console.error(`❌ Failed for ${m.name}:`, err.message || err);
            }
        }

    } catch (e) {
        console.error("❌ Test execution failed:", e);
    }
}

main();
