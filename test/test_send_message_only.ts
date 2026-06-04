/**
 * Test that starts a Cascade, sends a message, and then exits.
 * (Does not wait for streaming to finish / exits without processing the stream.)
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
        
        // cascade.run() internally waits until completion, but since we register
        // no event listeners it produces no output.
        await cascade.run(msg, { timeoutMs: 30000 });
        
        console.log("✅ Message sent and processed successfully.");
        console.log("🏁 Test completed cleanly.");
        
        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Test failed:", (e as Error).message);
    }
}

main();
