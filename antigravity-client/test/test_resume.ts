
import { AntigravityClient } from "../src/client.js";

async function main() {
    const cascadeId = process.argv[2];
    if (!cascadeId) {
        console.error("Usage: npx tsx src/test_resume.ts <CASCADE_ID>");
        process.exit(1);
    }

    console.log(`🔌 Connecting and resuming cascade: ${cascadeId}...`);
    const client = await AntigravityClient.connect();
    const cascade = client.getCascade(cascadeId);

    console.log("📜 Fetching history...");
    const history = await cascade.getHistory();

    if (history.trajectory?.steps) {
        console.log(`✅ Found ${history.trajectory.steps.length} steps.`);

        history.trajectory.steps.forEach((step, i) => {
            if (!step.step) return;

            console.log(`\n--- Step ${i} [${step.step.case}] ---`);
            if (step.step.case === "plannerResponse") {
                const val = step.step.value as any;
                if (val.thinking) console.log(`🧠 [Thinking]: ${val.thinking}`);
                if (val.response) console.log(`📝 [Response]: ${val.response}`);
                if (val.toolCalls?.length) {
                    console.log(`🛠️ TOOLS: ${val.toolCalls.map((t: any) => t.toolCall?.case).join(", ")}`);
                }
            } else if (step.step.case === "userInput") {
                const val = step.step.value as any;
                console.log(`👤 [User]: ${val.items?.map((it: any) => it.chunk?.value).join("")}`);
            } else {
                // Tool calls, etc.
                console.log(`🛠️ ${step.step.case} (Status: ${step.status})`);
            }
        });
    }

    console.log("\n📨 Resuming conversation. Sending a follow-up...");
    await cascade.sendMessage("今の内容を要約してください。");

    // Listen for new updates
    cascade.on("text", (ev) => process.stdout.write(ev.delta));

    // Keep alive
    await new Promise(r => setTimeout(r, 30000));
}

main().catch(console.error);
