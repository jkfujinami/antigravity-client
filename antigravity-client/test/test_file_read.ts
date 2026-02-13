
import { AntigravityClient } from "../src/client.js";
import { Model } from "../src/gen/exa/codeium_common_pb_pb.js";

async function main() {
    console.log("🔌 Connecting to Antigravity...");
    const client = await AntigravityClient.connect();
    console.log("✅ Connected.");

    console.log("🚀 Starting new cascade for tool test...");
    const cascade = await client.startCascade();
    console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

    // Listen to updates
    cascade.on("text", (ev) => {
        process.stdout.write(ev.delta);
    });

    cascade.on("thinking", (ev) => {
        process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`);
    });

    cascade.on("error", (err) => {
        console.error("\n❌ Cascade Error:", err);
    });

    // We can also see the state updates for tool execution
    cascade.on("update", (state) => {
        const steps = state.trajectory?.steps || [];
        const lastStep = steps[steps.length - 1];
        if (lastStep && lastStep.step?.case !== "plannerResponse" && lastStep.step?.case !== "userInput") {
             // Only log once per state change for tool calls
             // (This is primitive but okay for this test)
             if (lastStep.status === 2) {
                 process.stdout.write(`\n🛠️  Executing tool: ${lastStep.step.case}...\n`);
             }
        }
    });

    console.log("📨 Sending instruction...");
    const instruction = "Test.txtというファイルの中身を読んで、その内容を正確に復唱してください。";
    await cascade.sendMessage(instruction, { model: Model.PLACEHOLDER_M18 });
    console.log("\n✅ Instruction sent. Waiting for response...\n");

    // Keep process alive
    await new Promise(r => setTimeout(r, 60000));
}

main().catch(console.error);
