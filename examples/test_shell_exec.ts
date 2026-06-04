import { AntigravityClient, Cascade } from "../src/index.js";
import type { TextDeltaEvent, ThinkingDeltaEvent, StepNewEvent, ApprovalRequest, StepUpdateEvent, CommandOutputEvent } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    const client = await AntigravityClient.connect({ autoDetect: true });

    console.log("🚀 Starting new cascade...");
    const cascade = await client.startCascade();
    console.log(`🚀 Started cascade: ${cascade.cascadeId}`);

    console.log("📨 Sending request: 'ls -a を実行してください'");

    // Handle Text Deltas
    cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => process.stdout.write(ev.delta));
    cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => process.stdout.write(`(thinking: ${ev.delta})`));

    // Log newly generated steps
    cascade.on(Cascade.Events.StepNew, (ev: StepNewEvent) => {
        const step = ev.step;
        console.log(`\n[Step ${step.index}] Type: ${step.type}, Status: ${step.status}`);
        
        if (step.is("plannerResponse")) {
             if (step.thinkingText) console.log(`  🧠 Thinking: ${step.thinkingText.substring(0, 50)}...`);
             if (step.responseText) console.log(`  📝 Response: ${step.responseText.substring(0, 50)}...`);
        }
        
        if (step.is("runCommand")) {
             console.log(`  💻 Command: ${step.commandLine}`);
             console.log(`  🚦 AutoRun: ${step.value.shouldAutoRun}, UsedTerminal: ${step.value.usedIdeTerminal}`);
        }
    });

    // Handle interactive approvals
    cascade.on(Cascade.Events.Interaction, async (req: ApprovalRequest) => {
        if (req.type === "run_command") {
            console.log(`\n🛑 AI wants to run command: [${req.commandLine}]`);
            console.log("✅ Approving command...");
            try {
                await req.approve();
                console.log("🚀 Command Approved!");
            } catch (err: unknown) {
                console.error("❌ Approval Failed:", err);
            }
        }
    });

    // Log command output dynamically
    cascade.on(Cascade.Events.CommandOutput, (ev: CommandOutputEvent) => {
        // Here we just log the new chunks of output as they stream in
        process.stdout.write(`\n[CmdOutput - Step ${ev.stepIndex}]: ${ev.delta}`);
    });

    // Log when step changes status (e.g. command finishes)
    cascade.on(Cascade.Events.StepUpdate, (ev: StepUpdateEvent) => {
        if (ev.step.is("runCommand") && ev.step.status === "done") {
             console.log(`\n🎉 Command Finshed!`);
             console.log(`Output: ${ev.step.stdout || "(No output captured yet?)"}`);
        }
    });

    // We can use cascade.run() to await the full sequence completion
    await cascade.run("ls -a コマンドを実行して、その結果を教えてください。", { timeoutMs: 60000 });

    console.log("\nSequence complete.");
    client.dispose();
}

main().catch(console.error);
