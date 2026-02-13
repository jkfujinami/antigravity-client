
import { AntigravityClient } from "./client.js";
import { Cascade } from "./cascade.js";
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const SESSION_FILE = path.join(process.cwd(), '.last_cascade_id');

// CLI State
interface CliState {
    client: AntigravityClient | null;
    cascade: Cascade | null;
    cascadeId: string | null;
}

const state: CliState = {
    client: null,
    cascade: null,
    cascadeId: null
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

function log(msg: string) {
    process.stdout.write(msg + '\n');
}

// Main logic
async function init() {
    log(`${colors.cyan}--- Antigravity Interactive CLI v0.2 ---${colors.reset}`);
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
                // Ideally check validity here, for now just assume it exists
                state.cascade = state.client.getCascade(savedId);
                state.cascadeId = savedId;
                log(`${colors.yellow}↻ Resumed session: ${savedId}${colors.reset}`);
                setupListeners(state.cascade);
            } catch (e) {
                log(`${colors.red}⚠ Failed to resume session ${savedId}${colors.reset}`);
            }
        }
    }

    if (!state.cascade) {
        await startNewSession();
    }

    repl();
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
    cascade.on('thinking', (ev: any) => {
        process.stdout.write(`${colors.gray}${ev.delta}${colors.reset}`);
    });

    cascade.on('text', (ev: any) => {
        process.stdout.write(ev.delta);
    });

    cascade.on('error', (err: any) => {
        log(`${colors.red}Error: ${err}${colors.reset}`);
    });

    // Optional: Add 'done' detection if supported
    // cascade.on('done', () => { ... });
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
                log(`Status: ${state.cascade.state.status || 'UNKNOWN'}`);
            } else {
                log("No active session.");
            }
            return true;

        default:
            log(`${colors.red}Unknown command: ${command}${colors.reset}`);
            return true;
    }
}

function repl() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${colors.blue}antigravity>${colors.reset} `
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) {
            rl.prompt();
            return;
        }

        if (input.startsWith('/')) {
            await handleCommand(input);
            rl.prompt();
            return;
        }

        if (!state.cascade) {
            log(`${colors.red}No active session! Run /new${colors.reset}`);
            rl.prompt();
            return;
        }

        process.stdout.write('\n'); // Newline before response

        try {
            await state.cascade.sendMessage(input);
        } catch (e) {
            log(`${colors.red}Error: ${e}${colors.reset}`);
        }

        // Note: Response will stream asynchronously.
        // We don't reprint prompt immediately to avoid messing up the stream.
        // User can still type blindly if they want, but usually they wait.
    });
}

init().catch(console.error);
