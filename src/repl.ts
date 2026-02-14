
import { AntigravityClient } from "./client.js";
import { Cascade } from "./cascade.js";
import {
    CortexStepStatus,
    PermissionScope
} from "./gen/exa/cortex_pb_pb.js";
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const SESSION_FILE = path.join(process.cwd(), '.last_cascade_id');

// CLI State
interface CliState {
    client: AntigravityClient | null;
    cascade: Cascade | null;
    cascadeId: string | null;
    isWaitingForApproval: boolean;
    debugMode: boolean; // Debug flag

    // Tracking for verbose output
    lastStepCount: number;
    lastStepStatuses: Map<number, number>;
}

const state: CliState = {
    client: null,
    cascade: null,
    cascadeId: null,
    isWaitingForApproval: false,
    debugMode: false,
    lastStepCount: 0,
    lastStepStatuses: new Map()
};

// Utilities for colored output
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
};

// Global readline interface
let rl: readline.Interface | null = null;
const promptStr = `${colors.blue}antigravity>${colors.reset} `;

function log(msg: string) {
    process.stdout.write(msg + '\n');
}

// Helper to ask question using a temporary readline or by pausing the main one
async function askQuestion(query: string): Promise<string> {
    if (rl) {
        rl.pause(); // Pause main loop
    }

    const tempRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => {
        tempRl.question(query, (answer) => {
            tempRl.close();
            if (rl) rl.resume();
            resolve(answer);
        });
    });
}


// Main logic
async function init() {
    log(`${colors.cyan}--- Antigravity Interactive CLI v0.4 ---${colors.reset}`);
    log(`${colors.dim}Connecting to Language Server...${colors.reset}`);

    try {
        state.client = await AntigravityClient.connect({ autoDetect: true });
        log(`${colors.green}✔ Connected to Language Server${colors.reset}`);
    } catch (e) {
        log(`${colors.red}❌ Failed to connect: ${e}${colors.reset}`);
        process.exit(1);
    }

    // Restore session if exists
    if (fs.existsSync(SESSION_FILE)) {
        const savedId = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
        if (savedId) {
            try {
                log(`${colors.yellow}↻ Resuming session: ${savedId}...${colors.reset}`);
                state.cascade = state.client.getCascade(savedId);
                // Verify
                await state.cascade.getHistory();
                state.cascadeId = savedId;
                setupListeners(state.cascade);
                log(`${colors.green}✔ Resumed.${colors.reset}`);
            } catch (e) {
                log(`${colors.red}⚠ Failed to resume session ${savedId} (Expired?)${colors.reset}`);
                state.cascade = null;
            }
        }
    }

    if (!state.cascade) {
        await startNewSession();
    }

    initRepl();
}

async function startNewSession() {
    if (!state.client) return;
    log(`${colors.magenta}✨ Starting new session...${colors.reset}`);

    // Clean up old listeners if any
    if (state.cascade) {
        state.cascade.removeAllListeners();
    }

    // Reset state tracking
    state.lastStepCount = 0;
    state.lastStepStatuses.clear();

    state.cascade = await state.client.startCascade();
    state.cascadeId = state.cascade.cascadeId;
    if (state.cascadeId) {
        fs.writeFileSync(SESSION_FILE, state.cascadeId);
        log(`${colors.green}✔ Session created: ${state.cascadeId}${colors.reset}`);
        setupListeners(state.cascade);
    }
}

function getStatusName(status: number): string {
    switch (status) {
        case CortexStepStatus.UNSPECIFIED: return "UNSPECIFIED";
        case CortexStepStatus.PENDING: return "PENDING";
        case CortexStepStatus.RUNNING: return "RUNNING";
        case CortexStepStatus.DONE: return "DONE";
        case CortexStepStatus.ERROR: return "ERROR";
        case CortexStepStatus.CANCELED: return "CANCELED";
        case CortexStepStatus.WAITING: return "WAITING";
        default: return `UNKNOWN(${status})`;
    }
}

function getStepDescription(step: any): string {
    if (!step.step || !step.step.case) return "Unknown Step";

    const type = step.step.case;
    let details = "";

    switch (type) {
        case "runCommand":
            details = step.step.value.commandLine || step.step.value.proposedCommandLine || "";
            break;
        case "writeToFile":
             // Try to extract file path if available in encodedFiles or value
             if (step.step.value.encodedFiles && step.step.value.encodedFiles.length > 0) {
                 details = step.step.value.encodedFiles.map((f: any) => f.filePath).join(", ");
             }
             break;
        case "viewFile":
             details = step.step.value.filePath || "";
             break;
        case "plannerResponse":
             details = "(Thinking/Response)";
             break;
        default:
             details = "";
    }

    return `${type}${details ? `: ${details}` : ''}`;
}

function setupListeners(cascade: Cascade) {
    // 0. General Update Handler for Verbose Logging
    cascade.on('update', (s: any) => {
        const trajectory = s.trajectory;
        if (!trajectory || !trajectory.steps) return;

        const steps = trajectory.steps;

        // Check for new steps
        if (steps.length > state.lastStepCount) {
             for (let i = state.lastStepCount; i < steps.length; i++) {
                 const step = steps[i];
                 const desc = getStepDescription(step);
                 // Only log significant steps (skip plannerResponse creating noise)
                 if (step.step?.case !== 'plannerResponse') {
                    log(`${colors.magenta}[Step ${i}] New: ${desc} (Status: ${getStatusName(step.status)})${colors.reset}`);
                 }
                 state.lastStepStatuses.set(i, step.status);
             }
             state.lastStepCount = steps.length;
        }

        // Check for status changes
        steps.forEach((step: any, index: number) => {
            const lastStatus = state.lastStepStatuses.get(index);
            if (lastStatus !== undefined && lastStatus !== step.status) {
                const desc = getStepDescription(step);
                // Skip repetitive logs for plannerResponse or trivial status changes if needed
                if (step.step?.case !== 'plannerResponse') {
                    log(`${colors.magenta}[Step ${index}] Status: ${getStatusName(lastStatus)} -> ${getStatusName(step.status)} (${desc})${colors.reset}`);
                }
                state.lastStepStatuses.set(index, step.status);
            }
        });
    });

    cascade.on('thinking', (ev: any) => {
        if (!state.isWaitingForApproval) {
            process.stdout.write(`${colors.gray}${ev.delta}${colors.reset}`);
        }
    });

    cascade.on('text', (ev: any) => {
        if (!state.isWaitingForApproval) {
            process.stdout.write(ev.delta);
        }
    });

    cascade.on('error', (err: any) => {
        log(`${colors.red}\nError: ${err}${colors.reset}`);
        if (!state.isWaitingForApproval) {
            if (rl) rl.prompt();
        }
    });

    // Debug Handler
    cascade.on('raw_update', (ev: any) => {
        if (state.debugMode) {
             const timestamp = new Date().toISOString();
             const diff = ev.diff;
             const logEntry = `\n[${timestamp}] RAW UPDATE:\n` + JSON.stringify(diff, (key, value) => {
                 if (key === 'windowId') return undefined;
                 if (key === 'view' && value?.case === 'file') return '[File View Content]';
                 if (typeof value === 'bigint') return value.toString();
                 if (value && value.type === 'Buffer') return `[Binary: ${value.data.length} bytes]`;
                 return value;
            }, 2) + "\n\n";

            try {
                fs.appendFileSync(path.join(process.cwd(), 'debug_log.log'), logEntry);
            } catch (err) {
                 log(`${colors.red}Failed to write debug log: ${err}${colors.reset}`);
            }
        }
    });

    // 1. Output handler
    cascade.on('command_output', (ev: any) => {
        if (ev.outputType === 'stderr') {
            process.stdout.write(`${colors.red}${ev.delta}${colors.reset}`);
        } else {
            process.stdout.write(ev.delta);
        }
    });

    // 2. Interaction handler
    cascade.on('interaction', async (ev: any) => {
        const interaction = ev.interaction;
        const type = interaction.interaction.case;
        const stepIndex = ev.stepIndex;
        const step = state.cascade?.state?.trajectory?.steps?.[stepIndex];

        process.stdout.write('\n'); // Clear line

        if (state.debugMode) {
             log(`${colors.gray}[Debug] Interaction: ${type} (Step ${stepIndex})${colors.reset}`);
        }

        switch (type) {
            case "runCommand": {
                const cmd = ev.commandLine;
                if (!cmd) {
                     log(`${colors.red}[Error] No command line found for step ${stepIndex}${colors.reset}`);
                     return;
                }

                if (ev.needsApproval) {
                    await handleRequest(
                        "Run Command",
                        cmd,
                        async () => await state.cascade?.approveCommand(stepIndex, cmd, cmd)
                    );
                } else {
                    log(`${colors.gray}[Auto-Run] Executing: ${cmd}${colors.reset}`);
                }
                break;
            }

            case "filePermission": {
                const val = interaction.interaction.value;
                const pathUri = val.absolutePathUri;

                await handlePermissionRequest(
                    "File Permission",
                    `Access: ${pathUri}`,
                    async (scope) => await state.cascade?.approveFilePermission(stepIndex, pathUri, scope)
                );
                break;
            }

            case "openBrowserUrl": {
                // URL is in the step, not the interaction
                let url = "Unknown URL";
                if (step && step.step?.case === "openBrowserUrl") {
                    url = step.step.value.url;
                }

                await handleRequest(
                    "Open Browser",
                    `URL: ${url}`,
                    async () => await state.cascade?.approveOpenBrowserUrl(stepIndex)
                );
                break;
            }

            default:
                log(`${colors.yellow}Received unhandled interaction: ${type}${colors.reset}`);
                break;
        }
    });

    cascade.on('done', () => {
        if (!state.isWaitingForApproval) {
            process.stdout.write('\n');
            if (rl) rl.prompt();
        }
    });
}

async function handleRequest(title: string, details: string, approveAction: () => Promise<void>) {
    if (state.isWaitingForApproval) return; // Simple debounce/blocking
    state.isWaitingForApproval = true;

    log(`\n${colors.yellow}🔔 AI Request: ${title}${colors.reset}`);
    log(`${colors.white}> ${details}${colors.reset}`);

    const answer = await askQuestion(`${colors.yellow}Allow? [Y/n] > ${colors.reset}`);
    const normalized = answer.trim().toLowerCase();

    if (normalized === '' || normalized === 'y' || normalized === 'yes') {
        try {
            await approveAction();
            log(`${colors.green}✔ Approved.${colors.reset}`);
        } catch (e) {
            log(`${colors.red}❌ Failed to approve: ${e}${colors.reset}`);
        }
    } else {
        log(`${colors.red}✖ Skipped (Denied).${colors.reset}`);
    }

    state.isWaitingForApproval = false;
    if (rl) rl.prompt();
}

/**
 * Specialized handler for file permissions allowing scope selection.
 */
async function handlePermissionRequest(title: string, details: string, approveAction: (scope: PermissionScope) => Promise<void>) {
    if (state.isWaitingForApproval) return;
    state.isWaitingForApproval = true;

    log(`\n${colors.yellow}🔔 AI Request: ${title}${colors.reset}`);
    log(`${colors.white}> ${details}${colors.reset}`);

    log(`${colors.white}Options:${colors.reset}`);
    log(`  [1] Allow Once`);
    log(`  [2] Allow This Conversation`);
    log(`  [n] Deny`);

    const answer = await askQuestion(`${colors.yellow}Selection [1/2/n] > ${colors.reset}`);
    const normalized = answer.trim().toLowerCase();

    let scope: PermissionScope | null = null;
    if (normalized === '1' || normalized === '') {
        scope = PermissionScope.ONCE;
    } else if (normalized === '2') {
        scope = PermissionScope.CONVERSATION;
    }

    if (scope !== null) {
        try {
            await approveAction(scope);
            log(`${colors.green}✔ Approved (${scope === PermissionScope.ONCE ? "Once" : "Conversation"}).${colors.reset}`);
        } catch (e) {
            log(`${colors.red}❌ Failed to approve: ${e}${colors.reset}`);
        }
    } else {
        log(`${colors.red}✖ Skipped (Denied).${colors.reset}`);
    }

    state.isWaitingForApproval = false;
    if (rl) rl.prompt();
}

async function handleCommand(cmd: string): Promise<boolean> {
    const args = cmd.trim().split(/\s+/);
    const command = args[0].toLowerCase();

    switch (command) {
        case '/exit':
        case '/quit':
            log("Bye!");
            process.exit(0);
            return true;

        case '/debug':
             if (args[1] === 'on') {
                 state.debugMode = true;
                 log(`${colors.yellow}Debug mode ON. Logging to debug_log.log${colors.reset}`);
             } else if (args[1] === 'off') {
                 state.debugMode = false;
                 log(`${colors.yellow}Debug mode OFF.${colors.reset}`);
             } else {
                 log(`Debug mode is currently: ${state.debugMode ? 'ON' : 'OFF'}`);
             }
             return true;

        case '/new':
        case '/reset':
            await startNewSession();
            // Since we replaced the cascade object, we need to re-init prompt maybe?
            // Actually setupListeners handles events.
            return true;

        case '/clear':
            console.clear();
            return true;

        case '/info':
        case '/status':
            if (state.cascade) {
                log(`Session ID: ${state.cascadeId}`);
                log(`Status: Active`);
            } else {
                log("No active session.");
            }
            return true;

        default:
            log(`${colors.red}Unknown command: ${command}${colors.reset}`);
            return true;
    }
}

function initRepl() {
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: promptStr
    });

    // Safety check
    if (!rl) return;

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
            if (rl) rl.prompt();
            return;
        }

        if (input.startsWith('/')) {
            await handleCommand(input);
            if (rl) rl.prompt();
            return;
        }

        if (!state.cascade) {
            log(`${colors.red}No active session! Run /new${colors.reset}`);
            if (rl) rl.prompt();
            return;
        }

        // If we are waiting for approval, we shouldn't be sending messages generally,
        // but 'line' event handling here is mutually exclusive with askQuestion's tempRl usually
        // if we pause correctly.
        if (state.isWaitingForApproval) return;

        process.stdout.write('\n'); // Newline before response flow starts

        try {
            await state.cascade.sendMessage(input);
        } catch (e) {
            log(`${colors.red}Error: ${e}${colors.reset}`);
        }
    });

    rl.on('SIGINT', () => {
        log("\nUse /exit to quit.");
        if (rl) rl.prompt();
    });
}

init().catch(console.error);
