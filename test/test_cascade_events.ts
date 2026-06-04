/**
 * Test that uses cascade.on() to capture and verify the various events emitted by a Cascade.
 */
import { AntigravityClient, Cascade } from "../src/index.js";
import type { TextDeltaEvent, ThinkingDeltaEvent } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("🚀 Starting new cascade...");
        const cascade = await client.startCascade();
        console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

        console.log("📡 Registering event listeners (cascade.on)...");

        // Receive text chunks
        cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
            process.stdout.write(ev.delta);
        });

        // Receive thinking-process chunks
        cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => {
            process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`);
        });

        // Receive errors
        cascade.on(Cascade.Events.Error, (err: any) => {
            console.error("\n❌ [Event: Error] ", err);
        });

        // Receive the run-completed event
        cascade.on(Cascade.Events.Done, () => {
            console.log("\n✅ [Event: Done] Cascade stream has naturally ended.");
        });

        const msg = "自己紹介をしてください。思考プロセス（Thinking）を含めて短めにお願いします。";
        console.log(`\n📨 Sending message: "${msg}"`);
        console.log("--------------------------------------------------");
        
        // Send the message (we use cascade.run to wait for stream completion,
        // but the point is to test that the events fire correctly internally).
        await cascade.run(msg, { timeoutMs: 60000 });
        
        console.log("--------------------------------------------------");
        console.log("🏁 Test completed cleanly.");
        
        client.dispose();
    } catch (e: unknown) {
        console.error("\n❌ Test failed:", (e as Error).message);
    }
}

main();
