import { AntigravityClient } from "../src/client.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

async function main() {
    try {
        console.log("🔌 Connecting to local Antigravity Language Server...");
        const client = await AntigravityClient.connect();
        console.log("✅ Connected.");

        // モデルが認知している最新日付・カットオフデートを聞き出す詳細なプロンプト
        const prompt = "あなたが認識している最新の年月日（本日、または知識のカットオフデート）はいつですか？あなたが持っているナレッジの最終更新日について、詳細に教えてください。";
        console.log(`\n💬 Prompt to send:\n"${prompt}"\n`);

        // Model enum からすべての数値・キーペアを抽出
        // TypeScript の Enum は逆引き用オブジェクトとしても機能するため、文字列のキーのみをフィルタリング
        const modelNames = Object.keys(Model).filter(key => isNaN(Number(key)));
        
        console.log(`📊 Found ${modelNames.length} models in Model enum. Starting comprehensive test...\n`);

        const results: { modelName: string; enumValue: number; success: boolean; responseOrError: string }[] = [];

        for (const name of modelNames) {
            const val = Model[name as keyof typeof Model];
            if (val === Model.UNSPECIFIED) continue; // UNSPECIFIED はスキップ

            console.log(`\n🔄 Testing \x1b[36mModel.${name}\x1b[0m (Enum: ${val})...`);
            try {
                // タイムアウトまたは即座にレスポンスを検証
                const response = await client.getModelResponse(prompt, val);
                console.log(`🎉 \x1b[1;32mSUCCESS!\x1b[0m Response length: ${response.length}`);
                console.log(`\x1b[32m[Response]\x1b[0m\n${response}`);
                results.push({
                    modelName: name,
                    enumValue: val,
                    success: true,
                    responseOrError: response
                });
            } catch (err: any) {
                const errMsg = err.message || String(err);
                console.log(`❌ \x1b[31mFailed:\x1b[0m ${errMsg.substring(0, 100)}`);
                results.push({
                    modelName: name,
                    enumValue: val,
                    success: false,
                    responseOrError: errMsg
                });
            }
            console.log("-".repeat(50));
        }

        // テスト結果サマリーの表示
        console.log(`\n============================================================`);
        console.log(`📊 COMPREHENSIVE TEST SUMMARY`);
        console.log(`============================================================`);
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log(`✅ Successful Models (${successful.length}):`);
        for (const r of successful) {
            console.log(`  - \x1b[32m${r.modelName}\x1b[0m (Enum: ${r.enumValue})`);
            console.log(`    \x1b[90m${r.responseOrError.replace(/\n/g, ' ')}\x1b[0m\n`);
        }

        console.log(`❌ Failed Models (${failed.length}):`);
        // エラーの種類ごとに分類して簡潔に表示
        const errorCategories: Record<string, string[]> = {};
        for (const r of failed) {
            const shortErr = r.responseOrError.split('\n')[0] || "Unknown Error";
            if (!errorCategories[shortErr]) {
                errorCategories[shortErr] = [];
            }
            errorCategories[shortErr].push(`${r.modelName} (${r.enumValue})`);
        }

        for (const [err, models] of Object.entries(errorCategories)) {
            console.log(`  🛑 \x1b[31m${err}\x1b[0m:`);
            console.log(`     -> ${models.join(", ")}`);
        }
        console.log(`============================================================\n`);

    } catch (e) {
        console.error("❌ Comprehensive test execution failed:", e);
    }
}

main();
