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
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { MockExtensionServer, type LsInfo } from "./mock-extension-server.js";
import { createMetadataBinary } from "./metadata.js";
import { readAuthData, type AuthData } from "./auth-reader.js";
import type { ServerInfo } from "../autodetect.js";

const DEFAULT_LS_BINARY = path.join(
    "/Applications/Antigravity.app/Contents/Resources/app/extensions/antigravity/bin",
    `language_server_${process.platform === "darwin" ? "macos" : "linux"}_${process.arch === "arm64" ? "arm" : "x64"}`
);

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
    /** Verbose logging */
    verbose?: boolean;
}

export class Launcher extends EventEmitter {
    private mockServer: MockExtensionServer;
    private lsProcess: ChildProcess | null = null;
    private _lsInfo: LsInfo | null = null;
    private _csrfToken: string;
    private _workspaceId: string;
    private _running = false;

    private constructor(
        private options: Required<Pick<LauncherOptions, "lsBinaryPath" | "csrfToken" | "workspaceId" | "cloudCodeEndpoint" | "geminiDir" | "verbose">>,
        mockServer: MockExtensionServer,
    ) {
        super();
        this.mockServer = mockServer;
        this._csrfToken = options.csrfToken;
        this._workspaceId = options.workspaceId;
    }

    /** HTTPS port for Connect RPC (available after start) */
    get httpsPort(): number { return this._lsInfo?.httpsPort ?? 0; }
    /** HTTP port (available after start) */
    get httpPort(): number { return this._lsInfo?.httpPort ?? 0; }
    /** LSP port (available after start) */
    get lspPort(): number { return this._lsInfo?.lspPort ?? 0; }
    /** CSRF token used by this LS instance */
    get csrfToken(): string { return this._csrfToken; }
    /** Workspace ID */
    get workspaceId(): string { return this._workspaceId; }
    /** PID of the LS process */
    get pid(): number | undefined { return this.lsProcess?.pid; }
    /** Whether the LS is running */
    get running(): boolean { return this._running; }

    /**
     * Returns a ServerInfo compatible with AntigravityClient.connectWithServer()
     */
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

    /**
     * Start an independent Language Server.
     */
    static async start(options: LauncherOptions = {}): Promise<Launcher> {
        const workspacePath = options.workspacePath ?? process.cwd();
        const workspaceId = options.workspaceId ?? `indie-${path.basename(workspacePath)}`;
        const csrfToken = options.csrfToken ?? generateCsrfToken();
        const lsBinaryPath = options.lsBinaryPath ?? DEFAULT_LS_BINARY;
        const cloudCodeEndpoint = options.cloudCodeEndpoint ?? "https://daily-cloudcode-pa.googleapis.com";
        const geminiDir = options.geminiDir ?? path.join(os.tmpdir(), `gemini_${workspaceId}`);
        const verbose = options.verbose ?? false;

        // Validate LS binary exists
        if (!fs.existsSync(lsBinaryPath)) {
            throw new Error(`LS binary not found: ${lsBinaryPath}. Is Antigravity installed?`);
        }

        // Read auth data
        const authData = options.authData ?? readAuthData();
        if (!authData.apiKey) {
            throw new Error("No auth data found. Please log in to Antigravity first.");
        }

        // Create and start mock server
        const mockServer = new MockExtensionServer({
            port: 0, // Random port
            authData,
            verbose,
        });

        const resolvedOptions = { lsBinaryPath, csrfToken, workspaceId, cloudCodeEndpoint, geminiDir, verbose };
        const launcher = new Launcher(resolvedOptions, mockServer);

        // Ensure gemini dir exists
        fs.mkdirSync(geminiDir, { recursive: true });

        // Start mock server
        const mockPort = await mockServer.start();
        if (verbose) console.log(`[Launcher] Mock Extension Server on port ${mockPort}`);

        // Wait for LS to report its ports
        const lsInfoPromise = new Promise<LsInfo>((resolve) => {
            mockServer.once("ls-started", resolve);
        });

        // Spawn LS process
        const metadataBin = createMetadataBinary();
        const lsArgs = [
            `--extension_server_port=${mockPort}`,
            `--workspace_id=${workspaceId}`,
            `--gemini_dir=${geminiDir}`,
            `--app_data_dir=antigravity_client`,
            `--enable_lsp=true`,
            `--csrf_token=${csrfToken}`,
            `--random_port=true`,
            `--cloud_code_endpoint=${cloudCodeEndpoint}`,
        ];

        if (verbose) console.log(`[Launcher] Spawning: ${lsBinaryPath} ${lsArgs.join(" ")}`);

        launcher.lsProcess = spawn(lsBinaryPath, lsArgs, {
            stdio: ["pipe", "pipe", "pipe"],
        });

        // Write metadata to stdin
        launcher.lsProcess.stdin!.write(metadataBin);
        launcher.lsProcess.stdin!.end();

        // Handle LS output
        launcher.lsProcess.stderr?.on("data", (data: Buffer) => {
            const line = data.toString();
            if (verbose) process.stderr.write(`[LS] ${line}`);
            launcher.emit("log", line);
        });

        launcher.lsProcess.on("exit", (code) => {
            launcher._running = false;
            launcher.emit("exit", code);
            if (verbose) console.log(`[Launcher] LS exited with code ${code}`);
        });

        // Wait for LS to report ports (timeout 15s)
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("LS startup timeout (15s)")), 15000)
        );

        launcher._lsInfo = await Promise.race([lsInfoPromise, timeout]);
        launcher._running = true;

        if (verbose) {
            console.log(`[Launcher] LS ready - HTTPS:${launcher.httpsPort} HTTP:${launcher.httpPort} LSP:${launcher.lspPort}`);
        }

        return launcher;
    }

    /**
     * Stop the LS process and mock server.
     */
    async stop(): Promise<void> {
        if (this.lsProcess && !this.lsProcess.killed) {
            this.lsProcess.kill("SIGTERM");
            // Wait for graceful shutdown (max 5s)
            await new Promise<void>((resolve) => {
                const timer = setTimeout(() => {
                    this.lsProcess?.kill("SIGKILL");
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
