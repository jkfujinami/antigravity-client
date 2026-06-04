/**
 * 低レイヤの sendMessage() メソッドを直接テストするスクリプト
 * (run()のようには待機せず、送信リクエストが通るかだけを確認する)
 */
import { AntigravityClient } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("🚀 Starting new cascade...");
        const cascade = await client.startCascade();
        console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

        const msg = "このメッセージは低レイヤの sendMessage() から送信されています。";
        console.log(`📨 Invoking sendMessage(): "${msg}"`);
        
        // cascade.run() ではなく、直接 sendMessage() を叩く
        await cascade.sendMessage(msg);
        
        console.log("✅ sendMessage() executed successfully.");
        console.log("ℹ️ (Note: sendMessage is fire-and-forget. We are not waiting for the response stream here.)");
        
        console.log("🏁 Test completed cleanly.");
        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Test failed:", (e as Error).message);
    }
}

main();
