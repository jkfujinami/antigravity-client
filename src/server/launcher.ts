/**
 * Launcher - Independent LS Process Management
 *
 * Starts a Language Server process with a Mock Extension Server,
 * handles the full initialization handshake, and provides connection info.
 *
 * Usage:
 *   const ls = await Launcher.start({ workspacePath: "/path/to/project" });
 *   console.log(ls.httpsPort, ls.csrfToken);
 *   // ... use with AntigravityClient ...
 *   await ls.stop();
 */
import { spawn, ChildProcess, execSync } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { MockExtensionServer, type LsInfo } from "./mock-extension-server.js";
import { createMetadataBinary } from "./metadata.js";
import { readAuthData, type AuthData } from "./auth-reader.js";
import type { ServerInfo } from "../utils/autodetect.js";
import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { LanguageServerService } from "../gen/exa/language_server_pb/language_server_connect.js";
import { SetUserSettingsRequest, AddTrackedWorkspaceRequest } from "../gen/exa/language_server_pb/language_server_pb.js";
import { UserSettings, AgentBrowserTools, BrowserJsExecutionPolicy } from "../gen/exa/codeium_common_pb/codeium_common_pb.js";

const DEFAULT_LS_BINARY = process.platform === "darwin"
    ? path.join(
        "/Applications/Antigravity.app/Contents/Resources/bin",
        "language_server"
      )
    : process.platform === "win32"
    ? path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
        "Programs", "Antigravity", "resources", "bin", "language_server.exe"
      )
    : "/opt/Antigravity/resources/bin/language_server";

// Crash Monitoring Constants
const RESTART_WINDOW_MS = 60000;
const MAX_RESTARTS = 3;
const RESTART_COOLDOWN_MS = 2000;
const MAX_STDERR_BUFFER = 100000;
const CRASH_TRIGGER_PHRASES = [
    'panic:',
    'fatal error:',
    'unexpected fault address',
    'runtime:',
    'running GoogleExitFunction',
    'panic serving',
];

export interface LauncherOptions {
    /** Path to the workspace directory */
    workspacePath?: string;
    /** Custom workspace ID (auto-generated from workspacePath if not set) */
    workspaceId?: string;
    /** Path to the LS binary (auto-detected if not set) */
    lsBinaryPath?: string;
    /** CSRF token (auto-generated if not set) */
    csrfToken?: string;
    /** Cloud code endpoint */
    cloudCodeEndpoint?: string;
    /** Pre-loaded auth data (reads from state.vscdb if not set) */
    authData?: AuthData;
    /** Gemini config directory */
    geminiDir?: string;
    /**
     * App-data namespace under geminiDir, passed as `--app_data_dir`. Conversations/
     * history live in `<geminiDir>/<appDataDir>/`. Defaults to the isolated
     * "antigravity_client" so we don't clobber the IDE; set "antigravity" to share
     * the real IDE's history.
     */
    appDataDir?: string;
    /** Chrome DevTools Protocol port (default: 9222) */
    cdpPort?: number;
    /** Verbose logging */
    verbose?: boolean;
}

/**
 * Events emitted by `Launcher`:
 * - `"exit"`: `(code: number | null, signal: NodeJS.Signals | null) => void`
 * - `"crash"`: `(code: number | null, signal: NodeJS.Signals | null, trace?: string) => void`
 * - `"restarted"`: `() => void`
 * - `"error"`: `(err: Error) => void`
 * - `"log"`: `(line: string) => void`
 */
export class Launcher extends EventEmitter {
    private mockServer: MockExtensionServer;
    private lsProcess: ChildProcess | null = null;
    private _lsInfo: LsInfo | null = null;
    private _csrfToken: string;
    private _workspaceId: string;
    private _running = false;
    
    private intentionalTermination = false;
    private restartCount = 0;
    private lastRestartTime = 0;

    private constructor(
        private options: Required<Pick<LauncherOptions, "lsBinaryPath" | "csrfToken" | "workspaceId" | "cloudCodeEndpoint" | "geminiDir" | "appDataDir" | "verbose">>,
        mockServer: MockExtensionServer,
        private fullOptions: LauncherOptions,
    ) {
        super();
        this.mockServer = mockServer;
        this._csrfToken = options.csrfToken;
        this._workspaceId = options.workspaceId;
    }

    get httpsPort(): number { return this._lsInfo?.httpsPort ?? 0; }
    get httpPort(): number { return this._lsInfo?.httpPort ?? 0; }
    get lspPort(): number { return this._lsInfo?.lspPort ?? 0; }
    get csrfToken(): string { return this._csrfToken; }
    get workspaceId(): string { return this._workspaceId; }
    get pid(): number | undefined { return this.lsProcess?.pid; }
    get running(): boolean { return this._running; }

    get serverInfo(): ServerInfo {
        return {
            pid: this.lsProcess?.pid ?? 0,
            httpPort: this.httpPort,
            httpsPort: this.httpsPort,
            csrfToken: this._csrfToken,
            workspaceId: this._workspaceId,
            startTime: new Date(),
        };
    }

    static async start(options: LauncherOptions = {}): Promise<Launcher> {
        const workspacePath = options.workspacePath ?? process.cwd();
        const workspaceId = options.workspaceId ?? `indie-${path.basename(workspacePath)}`;
        const csrfToken = options.csrfToken ?? generateCsrfToken();
        const lsBinaryPath = options.lsBinaryPath ?? DEFAULT_LS_BINARY;
        const cloudCodeEndpoint = options.cloudCodeEndpoint ?? "https://daily-cloudcode-pa.googleapis.com";
        const geminiDir = options.geminiDir ?? path.join(os.tmpdir(), `gemini_${workspaceId}`);
        const appDataDir = options.appDataDir ?? "antigravity_client";
        const verbose = options.verbose ?? false;

        if (!fs.existsSync(lsBinaryPath)) {
            throw new Error(`LS binary not found: ${lsBinaryPath}. Is Antigravity installed?`);
        }

        const authData = options.authData ?? readAuthData();
        if (!authData.apiKey) {
            throw new Error("No auth data found. Please log in to Antigravity first.");
        }

        const mockServer = new MockExtensionServer({
            port: 0,
            authData,
            verbose,
            cdpPort: options.cdpPort,
        });

        const resolvedOptions = { lsBinaryPath, csrfToken, workspaceId, cloudCodeEndpoint, geminiDir, appDataDir, verbose };
        const launcher = new Launcher(resolvedOptions, mockServer, options);

        fs.mkdirSync(geminiDir, { recursive: true });

        const mockPort = await mockServer.start();
        if (verbose) console.log(`[Launcher] Mock Extension Server on port ${mockPort}`);

        if (verbose) console.log(`[Launcher] Pre-launching CDP Chrome...`);
        const browserOk = await mockServer.ensureBrowserReady();
        if (verbose) console.log(`[Launcher] Chrome pre-launch: ${browserOk ? 'OK' : 'FAILED'}`);

        await launcher.doStart();
        return launcher;
    }

    private async doStart(isRestart = false): Promise<void> {
        this.intentionalTermination = false;
        
        const lsInfoPromise = new Promise<LsInfo>((resolve) => {
            this.mockServer.once("ls-started", resolve);
        });

        const metadataBin = createMetadataBinary();
        
        // Advanced Injection Flags aligned with temp_app_asar
        const lsArgs = [
            "--extension_server_port", String(this.mockServer.port),
            "--workspace_id", this.options.workspaceId,
            "--gemini_dir", this.options.geminiDir,
            "--app_data_dir", this.options.appDataDir,
            "--enable_lsp",
            "--enable_sidecars",
            "--subclient_type", "hub",
            "--override_ide_name", "antigravity",
            "--csrf_token", this.options.csrfToken,
            "--http_server_port", "0",
            "--https_server_port", "0",
            "--lsp_port", "0",
            "--cloud_code_endpoint", this.options.cloudCodeEndpoint,
        ];

        if (this.options.verbose) console.log(`[Launcher] Spawning: ${this.options.lsBinaryPath} ${lsArgs.join(" ")}`);

        // Environment Synchronization
        const env = { ...process.env };
        env['AGY_BROWSER_ACTIVE_PORT_FILE'] = path.join(os.homedir(), ".gemini", "active_port.txt");

        this.lsProcess = spawn(this.options.lsBinaryPath, lsArgs, {
            stdio: ["pipe", "pipe", "pipe"],
            env
        });

        this.lsProcess.stdin!.write(metadataBin);
        this.lsProcess.stdin!.end();

        const logFile = path.join(os.tmpdir(), "antigravity_ls_combined.log");
        try { fs.appendFileSync(logFile, `\n--- LS Started at ${new Date().toISOString()} (PID: ${this.lsProcess.pid}) ---\n`); } catch (e) { }

        let stderrLength = 0;
        const stderrChunks: string[] = [];

        const logToDisk = (data: Buffer, prefix: string) => {
            const str = data.toString();
            try { fs.appendFileSync(logFile, `[${prefix}] ${str}`); } catch (e) { }
            if (this.options.verbose) process.stderr.write(`[LS:${prefix}] ${str}`);
            this.emit("log", str);
            
            if (prefix === "STDERR") {
                stderrChunks.push(str);
                stderrLength += str.length;
                while (stderrChunks.length > 0 && stderrLength > MAX_STDERR_BUFFER) {
                    stderrLength -= stderrChunks.shift()!.length;
                }
            }
        };

        this.lsProcess.stdout?.on("data", (data) => logToDisk(data, "STDOUT"));
        this.lsProcess.stderr?.on("data", (data) => logToDisk(data, "STDERR"));

        const exitPromise = new Promise<{code: number|null, signal: NodeJS.Signals|null, trace?: string}>((resolve) => {
            this.lsProcess!.on("exit", (code, signal) => {
                this._running = false;
                
                const fullStderr = stderrChunks.join("");
                const lines = fullStderr.split("\\n");
                let trace: string | undefined;
                let foundTrigger = false;
                const crashLines = [];
                for (const line of lines) {
                    if (CRASH_TRIGGER_PHRASES.some(p => line.includes(p))) foundTrigger = true;
                    if (foundTrigger) crashLines.push(line);
                }
                if (crashLines.length > 0) trace = crashLines.join("\\n");
                
                resolve({ code, signal, trace });
            });
        });

        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("LS startup timeout (15s)")), 15000)
        );

        this._lsInfo = await Promise.race([lsInfoPromise, timeout]);
        this._running = true;

        if (this.options.verbose) {
            console.log(`[Launcher] LS ready - HTTPS:${this.httpsPort} HTTP:${this.httpPort} LSP:${this.lspPort}`);
        }

        await this.injectSettingsAndWorkspace();

        if (isRestart) {
            this.emit("restarted");
        }

        // Setup crash monitor
        void exitPromise.then((info) => {
            this.emit("exit", info.code, info.signal);
            if (!this.intentionalTermination) {
                this.monitorLsCrashInternal(info);
            }
        });
    }

    private async injectSettingsAndWorkspace() {
        try {
            const transport = createConnectTransport({
                baseUrl: `https://127.0.0.1:${this.httpsPort}`,
                httpVersion: "2",
                nodeOptions: { rejectUnauthorized: false },
                interceptors: [(next) => async (req) => {
                    req.header.set("x-codeium-csrf-token", this.csrfToken);
                    return await next(req);
                }],
            });
            const lsClient = createPromiseClient(LanguageServerService, transport);

            const chromePaths = [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/usr/bin/google-chrome",
                "/usr/bin/google-chrome-stable",
                "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            ];
            const detectedChromePath = chromePaths.find(p => fs.existsSync(p)) || "";

            const browserSettings = new UserSettings({
                agentBrowserTools: AgentBrowserTools.ENABLED,
                browserCdpPort: this.mockServer.browserReady ? (this.fullOptions.cdpPort ?? 9222) : 0,
                browserChromePath: detectedChromePath || (process.platform === "win32"
                    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
                    : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
                browserUserProfilePath: path.join(os.homedir(), ".gemini", "antigravity-browser-profile"),
                browserJsExecutionPolicy: BrowserJsExecutionPolicy.TURBO,
            });

            await lsClient.setUserSettings(new SetUserSettingsRequest({ userSettings: browserSettings }));
        } catch (e: any) {
            if (e.code !== 12) console.warn(`[Launcher] ⚠️ Failed to inject browser settings:`, e);
        }

        if (this.fullOptions.workspacePath) {
            try {
                const transport = createConnectTransport({
                    baseUrl: `https://127.0.0.1:${this.httpsPort}`,
                    httpVersion: "2",
                    nodeOptions: { rejectUnauthorized: false },
                    interceptors: [(next) => async (req) => {
                        req.header.set("x-codeium-csrf-token", this.csrfToken);
                        return await next(req);
                    }],
                });
                const lsClient = createPromiseClient(LanguageServerService, transport);
                await lsClient.addTrackedWorkspace(new AddTrackedWorkspaceRequest({
                    workspace: this.fullOptions.workspacePath,
                    isPassiveWorkspace: false,
                }));
            } catch (e) {
                console.warn(`[Launcher] ⚠️ Failed to inject tracked workspace:`, e);
            }
        }
    }

    private monitorLsCrashInternal(info: {code: number|null, signal: NodeJS.Signals|null, trace?: string}) {
        if (this.intentionalTermination) return;

        this.emit("crash", info.code, info.signal, info.trace);
        
        const summary = info.signal ? `killed by signal ${info.signal}` : `exited with code ${info.code}`;
        console.error(`\\n[Launcher] LS crashed: ${summary}`);
        if (info.trace) {
            console.error('--- Crash Stack Trace ---');
            console.error(info.trace);
            console.error('--- End Crash Stack trace ---');
        }

        const now = Date.now();
        if (now - this.lastRestartTime > RESTART_WINDOW_MS) {
            this.restartCount = 0;
        }
        this.lastRestartTime = now;

        if (this.restartCount >= MAX_RESTARTS) {
            console.error(`[Launcher] LS crashed ${MAX_RESTARTS} times in a row. Giving up.`);
            return;
        }

        this.restartCount++;
        console.log(`[Launcher] Attempting restart ${this.restartCount}/${MAX_RESTARTS} in ${RESTART_COOLDOWN_MS / 1000}s...`);

        setTimeout(() => {
            if (this.intentionalTermination) return;
            this.doStart(true).catch(err => {
                console.error(`[Launcher] Failed to restart LS:`, err);
            });
        }, RESTART_COOLDOWN_MS);
    }

    async stop(): Promise<void> {
        this.intentionalTermination = true;
        if (this.lsProcess && !this.lsProcess.killed) {
            this.lsProcess.kill("SIGTERM");
            await new Promise<void>((resolve) => {
                const timer = setTimeout(() => {
                    if (process.platform === "win32") {
                        // SIGKILL is not reliable on Windows; use taskkill
                        try {
                            execSync(`taskkill /F /PID ${this.lsProcess!.pid}`, { stdio: "ignore" });
                        } catch { /* already exited */ }
                    } else {
                        this.lsProcess?.kill("SIGKILL");
                    }
                    resolve();
                }, 5000);
                this.lsProcess!.once("exit", () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
        }
        await this.mockServer.stop();
        this._running = false;
    }
}

function generateCsrfToken(): string {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
