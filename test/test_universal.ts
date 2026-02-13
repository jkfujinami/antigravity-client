
import { AntigravityClient } from "../src/client";
import { Cascade } from "../src/cascade";
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), '.last_cascade_id');

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    try {
        const client = await AntigravityClient.connect({ autoDetect: true });

        // Check if we have a saved cascade ID
        let cascadeId = "";
        if (fs.existsSync(SESSION_FILE)) {
            cascadeId = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
            // console.log(`📂 Found saved session ID: ${cascadeId}`);
        }

        let cascade: Cascade | undefined;

        if (cascadeId) {
            try {
                console.log(`♻️ Resuming cascade: ${cascadeId}...`);
                cascade = client.getCascade(cascadeId);
                // History fetch to verify session is alive
                await cascade.getHistory();
                console.log("✅ Resume successful.");
            } catch (e) {
                console.warn("⚠️ Failed to resume (maybe expired?), starting new one.");
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

        // 1. Interaction (The New Feature + AutoRun Flag)
        cascade.on("interaction", async (ev: any) => {
            console.log(`\n\n🔔 [Interaction Request] Step ${ev.interaction.stepIndex || ev.stepIndex}`);
            const interaction = ev.interaction!;
            const autoRun = ev.autoRun; // Get the flag

            if (interaction.interaction.case === "runCommand") {
                const cmd = interaction.interaction.value.proposedCommandLine;
                console.log(`   👉 AI wants to run command: \x1b[33m${cmd}\x1b[0m`);
                const autoRunStr = autoRun ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO (Approval Required)\x1b[0m';
                console.log(`   ⚙️  AutoRun Safe? : ${autoRunStr}`);

                if (autoRun) {
                     console.log("   🚀 Auto-running permitted by Server.");
                } else {
                     console.log("   🤔 User approval would be required here.");
                }

                console.log("   🤖 Approving command in 1s anyway for test...");
                await new Promise(r => setTimeout(r, 1000));

                await cascade!.approveCommand(ev.stepIndex!, cmd);
                console.log("   ✅ Command Approved!");
            } else {
                console.log("   ❓ Unknown interaction type:", interaction.interaction.case);
            }
        });

        // 2. Text Streaming
        cascade.on("text", (ev: any) => process.stdout.write(ev.delta || ""));
        cascade.on("thinking", (ev: any) => process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`));

        cascade.on("error", (err: any) => {
            console.error("\n❌ Error:", err);
        });

        // --- Send Request ---
        console.log("📨 Sending request...");
        await cascade.sendMessage(msg);

        // Keep alive for a bit to allow stream to complete
        console.log("\n(Waiting for completion...)");
        await new Promise(r => setTimeout(r, 15000));

    } catch (err) {
        console.error("Main Error:", err);
    }
}

main();
