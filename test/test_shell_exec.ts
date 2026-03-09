
import { AntigravityClient } from "../src/client.js";
import {
    CascadeRunCommandInteraction,
    CascadeUserInteraction,
} from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { HandleCascadeUserInteractionRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    const client = await AntigravityClient.connect({ autoDetect: true });

    console.log("🚀 Starting new cascade...");
    const cascade = await client.startCascade();
    console.log(`🚀 Started cascade: ${cascade.cascadeId}`);

    console.log("📨 Sending request: 'whoami を実行してください'");
    await cascade.sendMessage("whoami コマンドを実行して、その結果を教えてください。");

    // Listen for updates - FULL DEBUG MODE
    cascade.on("update", async (state) => {
        const steps = state.trajectory?.steps || [];
        console.log(`\n\n=== UPDATE DETECTED (${steps.length} Steps) ===`);

        steps.forEach((step: any, index: number) => {
            if (!step) return;
            const stepName = step.step?.case;
            const status = step.status;

            // Log everything!
            console.log(`[Step ${index}] Type: ${stepName || 'UNKNOWN'}, Status: ${status}`);

            // If it's a planner response, look inside
            if (stepName === "plannerResponse") {
                const thinking = step.step.value.thinking;
                const response = step.step.value.response;
                if (thinking) console.log(`  🧠 Thinking: ${thinking.substring(0, 50)}...`);
                if (response) console.log(`  📝 Response: ${response.substring(0, 50)}...`);
            }

            // If it's a runCommand, show details
            if (stepName === "runCommand") {
                const cmd = step.step.value;
                console.log(`  💻 Command: ${cmd.commandLine || cmd.proposedCommandLine}`);
                console.log(`  🚦 AutoRun: ${cmd.shouldAutoRun}, UsedTerminal: ${cmd.usedIdeTerminal}`);

                if (status === 1 || status === 9) { // PENDING or WAITING for user
                     if (!step._approved) {
                        console.log(`\n🛑 AI wants to run command: [${cmd.commandLine || cmd.proposedCommandLine}]`);
                        console.log("✅ Approving command...");
                        step._approved = true;

                        // Execute approval
                        cascade.approveCommand(index, cmd.commandLine || cmd.proposedCommandLine).then(() => {
                            console.log("🚀 Command Approved!");
                        }).catch(err => {
                            console.error("❌ Approval Failed:", err);
                        });
                     } else {
                         console.log("  (Already approved locally)");
                     }
                } else if (status === 3) {
                     // Command done
                     if (!step._logged_result) {
                        console.log(`\n🎉 Command Finshed!`);
                        console.log(`Output: ${cmd.stdout || cmd.combinedOutput?.stdout || "(No output captured yet?)"}`);
                        step._logged_result = true;
                     }
                }
            }
        });
    });

    cascade.on("text", (ev) => process.stdout.write(ev.delta));
    cascade.on("thinking", (ev) => process.stdout.write(`(thinking: ${ev.delta})`));

    // Keep alive long enough
    await new Promise(r => setTimeout(r, 60000));
}

main().catch(console.error);
