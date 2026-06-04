import { AntigravityClient, Cascade } from "../src/index.js";
import type { CascadeStep, RunStatus, StepStatus, TextDeltaEvent, CommandOutputEvent, StatusChangeEvent, StepNewEvent } from "../src/index.js";

// UI Helpers (ANSI Colors)
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
};

function log(msg: string) {
    console.log(`${colors.dim}[${new Date().toLocaleTimeString()}]${colors.reset} ${msg}`);
}

async function main() {
    console.clear();
    console.log(`${colors.bgBlue}${colors.bright}  ANTIGRAVITY CASCADE ENGINE - FULL 100% LISTENER  ${colors.reset}\n`);

    log(`${colors.blue}Connecting to Antigravity Language Server...${colors.reset}`);
    const client = await AntigravityClient.connect({
        autoDetect: true
    });

    log(`${colors.blue}Initiating Cascade Session...${colors.reset}`);
    const cascade = await client.startCascade();
    log(`${colors.green}Cascade ID:${colors.reset} ${colors.bright}${cascade.cascadeId}${colors.reset}`);

    log(`${colors.magenta}Initializing 100% AgentStateUpdate Stream...${colors.reset}`);

    cascade.on(Cascade.Events.StatusChange, (ev: StatusChangeEvent) => {
        const statusStr = ev.status.toUpperCase();
        process.stdout.write(`\n${colors.dim}[STATUS] ${statusStr}${colors.reset}\n`);
        if (ev.status === "idle" && ev.previousStatus !== "idle") {
             process.stdout.write(`\n${colors.green}✔ Turn Finished Successfully.${colors.reset}\n`);
        }
    });

    cascade.on(Cascade.Events.StepNew, (ev: StepNewEvent) => {
        const step = ev.step;
        const type = step.type;
        process.stdout.write(`\n${colors.bgMagenta}${colors.white} STEP ${step.index}: ${type} ${colors.reset}\n`);

        if (type === "userInput") {
            process.stdout.write(`${colors.dim}Query: ${step.value.userResponse}${colors.reset}\n`);
        } else if (type === "checkpoint") {
            process.stdout.write(`${colors.green}📌 Checkpoint Reached: ${step.value.checkpointId}${colors.reset}\n`);
        } else if (type !== "plannerResponse") {
            process.stdout.write(`${colors.yellow}🔨 Step: ${colors.bright}${type}${colors.reset}\n`);
            process.stdout.write(`${colors.dim}Data: ${JSON.stringify(step.value)}${colors.reset}\n`);
        }
    });

    // Handle Text Deltas
    cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
        process.stdout.write(ev.delta);
    });

    // Handle Command Deltas
    cascade.on(Cascade.Events.CommandOutput, (ev: CommandOutputEvent) => {
        process.stdout.write(ev.delta);
    });

    // Error handling
    cascade.on(Cascade.Events.Error, (err: unknown) => {
        console.error(`\n${colors.red}❗ STREAM FATAL ERROR: ${(err as Error).message}${colors.reset}`);
    });

    // Wait for initial connection stabilization
    await new Promise((r) => setTimeout(r, 1000));

    const prompt = "Explain the 'Antigravity' project mission. What makes it different from standard AI assistants?";
    log(`${colors.bright}Sending Payload:${colors.reset} ${colors.dim}${prompt}${colors.reset}`);

    // Send the message and wait for it to complete. 
    await cascade.run(prompt, {
        model: "Gemini_3_Flash"
    });

    console.log(`\n${colors.dim}--- [100% Listener Diagnostic End] ---${colors.reset}\n`);
    
    // Clean up connections
    client.dispose();
}

main().catch((err: unknown) => {
    console.error(`\n${colors.red}FATAL TERMINATION: ${(err as Error).message}${colors.reset}`);
});
