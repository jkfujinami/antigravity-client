/**
 * Cascadeを起動し、メッセージを送信するだけで終了するテスト
 * (ストリーミングの完了を待たない、またはストリームを処理せずに終了する)
 */
import { AntigravityClient } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("🚀 Starting new cascade...");
        const cascade = await client.startCascade();
        console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

        const msg = "こんにちは！これは送信のみのテストです。";
        console.log(`📨 Sending message: "${msg}"`);
        
        // cascade.run() は内部的に完了まで待機しますが、
        // イベントリスナーを登録しないため出力を何も行いません。
        await cascade.run(msg, { timeoutMs: 30000 });
        
        console.log("✅ Message sent and processed successfully.");
        console.log("🏁 Test completed cleanly.");
        
        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Test failed:", (e as Error).message);
    }
}

main();
