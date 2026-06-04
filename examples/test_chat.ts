import { AntigravityClient, Cascade } from "../src/index.js";
import type { TextDeltaEvent, ThinkingDeltaEvent } from "../src/types.js";

async function main() {
  try {
    console.log("🔌 Connecting...");
    const client = await AntigravityClient.connect();
    console.log("✅ Connected.");

    console.log("🚀 Starting new cascade...");
    const cascade = await client.startCascade();
    console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

    // Listen to updates
    cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
        process.stdout.write(ev.delta);
    });

    cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => {
        process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`);
    });

    cascade.on(Cascade.Events.Error, (err: unknown) => {
        console.error("\n❌ Cascade Error:", err);
    });

    console.log("📨 Sending message...");
    const msg = "Hello!なんか面白い創作の作品を考えて！<Thinking>...</Thinking>で徹底的に考えて！";
    await cascade.run(msg, { timeoutMs: 60000 });
    console.log("\n✅ Message sent and processed.");

    client.dispose();

  } catch (e: unknown) {
    console.error("❌ Chat Error:", e);
  }
}

main();
