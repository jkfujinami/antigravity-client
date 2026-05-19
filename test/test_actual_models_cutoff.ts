import { AntigravityClient } from "../src/client.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

async function main() {
    try {
        console.log("🔌 Connecting to local Antigravity Language Server...");
        const client = await AntigravityClient.connect();
        console.log("✅ Connected.");

        // モデルが認知している最新日付・カットオフデートを聞き出す詳細なプロンプト
        const prompt = "あなたが認識している最新の年月日（本日、または知識のカットオフデート）はいつですか？あなたが持っているナレッジの最終更新日について、日本語で簡潔に教えてください。";
        console.log(`\n💬 Prompt to send: "${prompt}"\n`);

        console.log("📡 Fetching active available models from LS to filter real models...");
        const res = await client.lsClient.getAvailableModels({});
        if (!res.response || !res.response.models) {
            console.error("❌ No models found in LS response!");
            process.exit(1);
        }

        // 実在する動作モデルの Enum 値を重複なく抽出
        const activeModels = new Map<number, { key: string; displayName: string; enumName: string }>();

        for (const entry of res.response.models) {
            const key = entry.key;
            const details = entry.value;
            if (!details) continue;

            const modelEnumVal = details.model;
            // Enumの文字列表現を取得
            const enumName = Model[modelEnumVal] || String(modelEnumVal);

            if (modelEnumVal !== Model.UNSPECIFIED) {
                activeModels.set(modelEnumVal, {
                    key: key,
                    displayName: details.displayName || key,
                    enumName: enumName
                });
            }
        }

        console.log(`📊 Found ${activeModels.size} unique active Model Enums. Starting targeted cutoff test...\n`);

        const results: { key: string; displayName: string; enumName: string; success: boolean; response: string }[] = [];

        for (const [enumVal, info] of activeModels.entries()) {
            console.log(`\n🔄 Testing ModelID: \x1b[1;36m${info.key}\x1b[0m | Enum: \x1b[36mModel.${info.enumName}\x1b[0m (Val: ${enumVal})...`);
            try {
                const response = await client.getModelResponse(prompt, enumVal);
                console.log(`🎉 \x1b[1;32mSUCCESS!\x1b[0m`);
                console.log(`\x1b[32m[Response]\x1b[0m ${response.trim()}`);
                results.push({
                    key: info.key,
                    displayName: info.displayName,
                    enumName: info.enumName,
                    success: true,
                    response: response.trim()
                });
            } catch (err: any) {
                const errMsg = err.message || String(err);
                console.log(`❌ \x1b[31mFailed:\x1b[0m ${errMsg.split('\n')[0]}`);
                results.push({
                    key: info.key,
                    displayName: info.displayName,
                    enumName: info.enumName,
                    success: false,
                    response: errMsg.split('\n')[0]
                });
            }
            console.log("-".repeat(60));
        }

        // 結果を美しくサマリー
        console.log(`\n============================================================`);
        console.log(`📊 TARGETED MODEL CUTOFF TEST SUMMARY`);
        console.log(`============================================================`);
        
        console.log("✅ SUCCESSFUL REAL MODELS:");
        const successful = results.filter(r => r.success);
        for (const r of successful) {
            console.log(`\n🤖 \x1b[1;32mModel: ${r.displayName}\x1b[0m (ID: ${r.key} | Enum: Model.${r.enumName})`);
            console.log(`   └─ \x1b[32mCutoff Response:\x1b[0m ${r.response.replace(/\n/g, '\n      ')}`);
        }

        console.log(`\n❌ FAILED/RESTRICTED REAL MODELS:`);
        const failed = results.filter(r => !r.success);
        for (const r of failed) {
            console.log(`  🛑 \x1b[31m${r.displayName}\x1b[0m (ID: ${r.key}) -> Error: ${r.response}`);
        }
        console.log(`============================================================\n`);

    } catch (e) {
        console.error("❌ Target test execution failed:", e);
    }
}

main();
