import { AntigravityClient, Cascade } from "../src/index.js";
import fs from 'fs';
import path from 'path';
import type { ApprovalRequest, TextDeltaEvent, ThinkingDeltaEvent } from "../src/index.js";

const SESSION_FILE = path.join(process.cwd(), '.last_cascade_id');

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    try {
        const client = await AntigravityClient.connect({ autoDetect: true });

        // Check if we have a saved cascade ID
        let cascadeId = "";
        if (fs.existsSync(SESSION_FILE)) {
            cascadeId = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
        }

        let cascade: Cascade | undefined;

        if (cascadeId) {
            try {
                console.log(`♻️ Resuming cascade: ${cascadeId}...`);
                // Using resumeCascade which validates if it is still alive
                cascade = await client.resumeCascade(cascadeId);
                console.log("✅ Resume successful.");
            } catch (e: unknown) {
                console.warn(`⚠️ Failed to resume (${(e as Error).message}), starting new one.`);
                cascade = undefined;
            }
        }

        if (!cascade) {
            console.log("🚀 Starting NEW cascade...");
            cascade = await client.startCascade();
            cascadeId = cascade.cascadeId;
            fs.writeFileSync(SESSION_FILE, cascadeId);
            console.log(`✨ New Cascade ID: ${cascadeId}`);
        }

        // Use a prompt that triggers a command execution
        const msg = process.argv[2] || "「ls -la」コマンドを実行して、結果を教えてください。";
        console.log(`Payload: "${msg}"`);

        // --- Event Listeners ---
        cascade.on(Cascade.Events.All, (ev: { event: string; data: unknown }) => {
            if (ev.event !== "rawUpdate") {
                console.log(`\x1b[90m[EVENT] ${ev.event}:\x1b[0m`, ev.data);
            }
        });

        // 1. Interaction (The New Feature + AutoRun Flag)
        cascade.on(Cascade.Events.Interaction, async (req: ApprovalRequest) => {
            console.log(`\n\n🔔 [Interaction Request] Step ${req.stepIndex}`);

            if (req.type === "run_command") {
                console.log(`   👉 AI wants to run command: \x1b[33m${req.commandLine}\x1b[0m`);
                const autoRunStr = req.autoRun ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO (Approval Required)\x1b[0m';
                console.log(`   ⚙️  AutoRun Safe? : ${autoRunStr}`);

                if (req.autoRun) {
                     console.log("   🚀 Auto-running permitted by Server.");
                } else {
                     console.log("   🤔 User approval would be required here.");
                }

                console.log("   🤖 Approving command in 1s anyway for test...");
                await new Promise(r => setTimeout(r, 1000));

                try {
                    await req.approve();
                    console.log("   ✅ Command Approved!");
                } catch (e) {
                    console.error("   ❌ Command Approval Failed", e);
                }
            } else {
                console.log("   ❓ Other interaction type:", req.type);
            }
        });

        // 2. Text Streaming
        cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => process.stdout.write(ev.delta));
        cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`));

        cascade.on(Cascade.Events.Error, (err: unknown) => {
            console.error("\n❌ Error:", err);
        });

        // --- Send Request ---
        console.log("📨 Sending request...");
        await cascade.sendMessage(msg, { model: 1018 });
        console.log("\n✅ Request finished.");

    } catch (err: unknown) {
        console.error("Main Error:", err);
    }
}

main();
