
import { AntigravityClient } from "./client.js";
import { Cascade } from "./cascade.js";
import type {
    ApprovalRequest,
    StepNewEvent,
    StepUpdateEvent,
    TextDeltaEvent,
    ThinkingDeltaEvent,
} from "./types.js";
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
    debugMode: boolean;
}

const state: CliState = {
    client: null,
    cascade: null,
    cascadeId: null,
    isWaitingForApproval: false,
    debugMode: false,
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
    log(`${colors.cyan}--- Antigravity Interactive CLI v0.5 ---${colors.reset}`);
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

    state.cascade = await state.client.startCascade();
    state.cascadeId = state.cascade.cascadeId;
    if (state.cascadeId) {
        fs.writeFileSync(SESSION_FILE, state.cascadeId);
        log(`${colors.green}✔ Session created: ${state.cascadeId}${colors.reset}`);
        setupListeners(state.cascade);
    }
}

function setupListeners(cascade: Cascade) {
    // ── Step Tracking (via high-level events from SDK) ──

    cascade.on('step:new', (ev: StepNewEvent) => {
        // Only log significant steps (skip plannerResponse to reduce noise)
        if (ev.step.category !== 'response') {
            log(`${colors.magenta}[Step ${ev.step.index}] New: ${ev.step.description} (${ev.step.status})${colors.reset}`);
        }
    });

    cascade.on('step:update', (ev: StepUpdateEvent) => {
        if (ev.step.category !== 'response') {
            log(`${colors.magenta}[Step ${ev.step.index}] ${ev.previousStatus} -> ${ev.step.status} (${ev.step.description})${colors.reset}`);
        }
    });

    // ── Text / Thinking Streaming ──

    cascade.on('text:delta', (ev: TextDeltaEvent) => {
        if (!state.isWaitingForApproval) {
            process.stdout.write(ev.delta);
        }
    });

    cascade.on('thinking:delta', (ev: ThinkingDeltaEvent) => {
        if (!state.isWaitingForApproval) {
            process.stdout.write(`${colors.gray}${ev.delta}${colors.reset}`);
        }
    });

    // ── Command Output ──

    cascade.on('command_output', (ev: any) => {
        if (ev.outputType === 'stderr') {
            process.stdout.write(`${colors.red}${ev.delta}${colors.reset}`);
        } else {
            process.stdout.write(ev.delta);
        }
    });

    // ── Approval Requests (via high-level event from SDK) ──

    cascade.on('approval:needed', async (request: ApprovalRequest) => {
        if (!request.needsApproval) {
            log(`${colors.gray}[Auto-Run] ${request.description}${colors.reset}`);
            return;
        }

        process.stdout.write('\n');

        if (request.type === "file_permission") {
            await handlePermissionRequest(request);
        } else {
            await handleSimpleApproval(request);
        }
    });

    // ── Error ──

    cascade.on('error', (err: any) => {
        log(`${colors.red}\nError: ${err}${colors.reset}`);
        if (!state.isWaitingForApproval) {
            if (rl) rl.prompt();
        }
    });

    // ── Done ──

    cascade.on('done', () => {
        if (!state.isWaitingForApproval) {
            process.stdout.write('\n');
            if (rl) rl.prompt();
        }
    });

    // ── Debug Handler ──

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
}

// ── Approval Handlers ──

async function handleSimpleApproval(request: ApprovalRequest) {
    if (state.isWaitingForApproval) return;
    state.isWaitingForApproval = true;

    log(`\n${colors.yellow}🔔 ${request.description}${colors.reset}`);

    const answer = await askQuestion(`${colors.yellow}Allow? [Y/n] > ${colors.reset}`);
    const normalized = answer.trim().toLowerCase();

    if (normalized === '' || normalized === 'y' || normalized === 'yes') {
        try {
            await request.approve();
            log(`${colors.green}✔ Approved.${colors.reset}`);
        } catch (e) {
            log(`${colors.red}❌ Failed: ${e}${colors.reset}`);
        }
    } else {
        log(`${colors.red}✖ Denied.${colors.reset}`);
    }

    state.isWaitingForApproval = false;
    if (rl) rl.prompt();
}

async function handlePermissionRequest(request: ApprovalRequest) {
    if (state.isWaitingForApproval) return;
    state.isWaitingForApproval = true;

    log(`\n${colors.yellow}🔔 ${request.description}${colors.reset}`);
    log(`${colors.white}Options:${colors.reset}`);
    log(`  [1] Allow Once`);
    log(`  [2] Allow This Conversation`);
    log(`  [n] Deny`);

    const answer = await askQuestion(`${colors.yellow}Selection [1/2/n] > ${colors.reset}`);
    const normalized = answer.trim().toLowerCase();

    if (normalized === '1' || normalized === '') {
        try {
            await request.approve("once");
            log(`${colors.green}✔ Approved (Once).${colors.reset}`);
        } catch (e) {
            log(`${colors.red}❌ Failed: ${e}${colors.reset}`);
        }
    } else if (normalized === '2') {
        try {
            await request.approve("conversation");
            log(`${colors.green}✔ Approved (Conversation).${colors.reset}`);
        } catch (e) {
            log(`${colors.red}❌ Failed: ${e}${colors.reset}`);
        }
    } else {
        log(`${colors.red}✖ Denied.${colors.reset}`);
    }

    state.isWaitingForApproval = false;
    if (rl) rl.prompt();
}

// ── Slash Commands ──

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

// ── REPL ──

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
