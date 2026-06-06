import { AntigravityClient, Cascade } from "../src/index.js";

async function run() {
    console.log("🔌 Connecting to Antigravity LS...");
    const client = await AntigravityClient.connect();
    console.log("✅ Connected!\n");

    console.log("🚀 Attempting to force Anthropic (Claude 3.5 Sonnet) via raw model ID (333)...");

    try {
        const cascade = await client.startCascade({
            source: 1, // CASCADE_CLIENT
            trajectoryType: 4, // CASCADE
            // 333 = CLAUDE_4_5_SONNET (discovered via protobuf inspection)
            requestedModel: 333 as any 
        });

        console.log(`✅ StartCascade accepted! Cascade ID: ${cascade.cascadeId}`);

        let responseText = "";
        cascade.on(Cascade.Events.Text, (ev) => {
            responseText += ev.delta;
            process.stdout.write(ev.delta);
        });

        console.log("\n🤖 Sending test message...\n");
        const result = await cascade.run("Hello, what model are you based on? Claude or Gemini?");
        
        console.log("\n\n✅ Turn Complete.");
        console.log(`Final Status: ${result.finalStatus}`);
    } catch (error) {
        console.error("\n❌ Failed to force Anthropic model connection:", error);
    }
}

run().catch(console.error);
