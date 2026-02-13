
import { AntigravityClient } from "../src/client.js";
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), '.last_cascade_id');

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    const client = await AntigravityClient.connect({ autoDetect: true });

    // Check if we have a saved cascade ID
    let cascadeId = "";
    if (fs.existsSync(SESSION_FILE)) {
        cascadeId = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
        console.log(`📂 Found saved session ID: ${cascadeId}`);
    }

    let cascade;

    if (cascadeId) {
        try {
            console.log(`♻️ Resuming cascade: ${cascadeId}...`);
            cascade = client.getCascade(cascadeId);
            // Optionally fetch history to verify validity
            await cascade.getHistory();
            console.log("✅ Resume successful.");
        } catch (e) {
            console.warn("⚠️ Failed to resume (maybe expired?), starting new one.");
            cascadeId = ""; // Reset to force new
        }
    }

    if (!cascadeId) {
        console.log("🚀 Starting NEW cascade...");
        cascade = await client.startCascade();
        cascadeId = cascade.cascadeId;
        fs.writeFileSync(SESSION_FILE, cascadeId);
        console.log(`✨ New Cascade ID: ${cascadeId} (Saved to .last_cascade_id)`);
    }

    // Prepare message
    const msg = process.argv[2] || "ほーん";
    console.log(`Payload: "${msg}"`);

    // Universal Event Listener - REGISTER BEFORE SENDING!
    cascade!.on("update", async (state) => {
        const steps = state.trajectory?.steps || [];

        steps.forEach((step: any, index: number) => {
            if (!step) return;

            const stepType = step.step?.case;
            const status = step.status; // 1=PENDING, 2=RUNNING, 3=DONE, etc.

            // Generate a unique key for this step state to avoid repetitive logging
            const stepKey = `${index}-${stepType}-${status}`;
            if ((step as any)._lastLoggedKey === stepKey) return;
            (step as any)._lastLoggedKey = stepKey;

            // Completely skip logging plannerResponse in the update loop
            // because we are streaming its content via 'text' event.
            if (stepType === "plannerResponse") {
                return;
            }

            // For other steps, break the line to ensure clean logging
            process.stdout.write('\n'); // Ensure we are on a new line
            console.log(`[Step ${index}] Type: ${stepType || 'UNKNOWN'}, Status: ${status}`);

            if (!stepType) {
                console.log("  Raw Step Dump:", JSON.stringify(step, (key, value) => {
                    if (key === 'parent') return undefined; // Avoid circular reference if any
                    if (typeof value === 'bigint') return value.toString();
                    return value;
                }, 2));
            }

            // Inspect Content (Universal dumper)
            if (stepType) {
                const value = step.step.value;
                dumpStepContent(stepType, value);
            }
        });
    });

    cascade!.on("text", (ev) => process.stdout.write(ev.delta || ""));
    cascade!.on("thinking", (ev) => process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`));

    // Send AFTER registering listeners
    console.log("📨 Sending request...");
    await cascade!.sendMessage(msg);

    // Keep alive
    await new Promise(r => setTimeout(r, 60000));
}

function dumpStepContent(type: string, value: any) {
    if (!value) return;

    // Common fields extraction
    const summary: any = {};

    // Command Execution
    if (type === "runCommand") {
        summary.command = value.commandLine || value.proposedCommandLine;
        summary.autoRun = value.shouldAutoRun;
        summary.output = value.combinedOutput?.stdout ? "Yes" : (value.stdout ? value.stdout.substring(0, 50) + "..." : "No");
    }
    // Tool Calls (Generic)
    else if (type.includes("tool")) {
        summary.tool = type;
        summary.args = value;
    }
    // User Input
    else if (type === "userInput") {
        summary.text = value.userResponse;
    }
    // Any other step with 'text' or 'content'
    else {
        // Try to dump interesting fields
        for (const k of Object.keys(value)) {
            if (typeof value[k] === 'string' && value[k].length > 0) {
                 summary[k] = value[k].substring(0, 100);
            } else if (typeof value[k] === 'number' || typeof value[k] === 'boolean') {
                 summary[k] = value[k];
            }
        }
    }

    if (Object.keys(summary).length > 0) {
        console.log("  Content:", JSON.stringify(summary, null, 2));
    }
}

main().catch(console.error);
