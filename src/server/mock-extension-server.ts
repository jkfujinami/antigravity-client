/**
 * Mock Extension Server
 *
 * Minimal Connect RPC server that impersonates the Antigravity Extension Server.
 * Provides OAuth tokens to the LS via the USS (Unified State Sync) protocol.
 *
 * Required RPCs:
 * - LanguageServerStarted: LS reports its ports after startup
 * - SubscribeToUnifiedStateSyncTopic: LS subscribes to "uss-oauth" for auth tokens
 * - GetChromeDevtoolsMcpUrl: LS polls for Chrome DevTools (stub)
 * - FetchMCPAuthToken: Fallback auth token fetch
 * - LogEvent / RecordError: Telemetry stubs
 */
import { ConnectRouter } from "@connectrpc/connect";
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { ExtensionServerService } from "../gen/exa/extension_server_pb/extension_server_connect.js";
import {
    LanguageServerStartedResponse,
    GetChromeDevtoolsMcpUrlResponse,
    FetchMCPAuthTokenResponse,
    UnifiedStateSyncUpdate,
    LogEventResponse,
    RecordErrorResponse,
    OpenFilePointerResponse,
    LaunchBrowserResponse,
    CheckTerminalShellSupportResponse,
    PushUnifiedStateSyncUpdateResponse,
} from "../gen/exa/extension_server_pb/extension_server_pb.js";
import { SmartFocusConversationResponse } from "../gen/exa/language_server_pb/language_server_pb.js";
import { Topic, Topic_DataEntry, Row } from "../gen/exa/unified_state_sync_pb/unified_state_sync_pb.js";
import {
    TerminalShellCommandStreamChunk,
    TerminalShellCommandHeader,
    TerminalShellCommandData,
    TerminalShellCommandTrailer,
    TerminalShellCommandSource
} from "../gen/exa/codeium_common_pb/codeium_common_pb.js";
import { Timestamp } from "@bufbuild/protobuf";

/** Encode a Timestamp as bytes (proto field is `bytes` due to well-known type fallback) */
function timestampBytes(): Uint8Array<ArrayBuffer> {
    return Timestamp.fromDate(new Date()).toBinary() as Uint8Array<ArrayBuffer>;
}
import * as http from "http";
import { EventEmitter } from "events";
import { spawn } from "child_process";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { readAuthData, type AuthData } from "./auth-reader.js";
// @ts-ignore — launcher_mcp may be JS-only
import { launchDevToolsMcp } from "./launcher_mcp.js";

export interface MockServerOptions {
    port?: number;         // Default: 0 (random)
    authData?: AuthData;   // If not provided, reads from state.vscdb
    verbose?: boolean;     // Log all requests
    cdpPort?: number;      // Chrome DevTools Port (default: 9222)
}

export interface LsInfo {
    httpsPort: number;
    httpPort: number;
    lspPort: number;
    csrfToken: string;
}

export class MockExtensionServer extends EventEmitter {
    private server: http.Server | null = null;
    private authData: AuthData;
    private verbose: boolean;
    private cdpPort: number;
    private _port: number;
    private _lsInfo: LsInfo = { httpsPort: 0, httpPort: 0, lspPort: 0, csrfToken: "" };
    private _browserReady = false;

    constructor(options: MockServerOptions = {}) {
        super();
        this._port = options.port ?? 0;
        this.verbose = options.verbose ?? false;
        this.cdpPort = options.cdpPort ?? 9222;
        this.authData = options.authData ?? readAuthData();
    }

    /** Whether the CDP browser has been confirmed ready */
    get browserReady(): boolean { return this._browserReady; }

    get port(): number { return this._port; }
    get lsInfo(): LsInfo { return this._lsInfo; }

    /**
     * Start the mock server. Returns the actual listening port.
     */
    async start(): Promise<number> {
        const self = this;
        const authData = this.authData;

        function routes(router: ConnectRouter) {
            router.service(ExtensionServerService, {
                languageServerStarted(req) {
                    self._lsInfo = {
                        httpsPort: req.httpsPort,
                        httpPort: req.httpPort,
                        lspPort: req.lspPort,
                        csrfToken: req.csrfToken,
                    };
                    self.emit("ls-started", self._lsInfo);
                    return new LanguageServerStartedResponse();
                },

                async *subscribeToUnifiedStateSyncTopic(req) {
                    if (req.topic === "uss-oauth") {
                        const topic = new Topic({
                            data: [
                                new Topic_DataEntry({
                                    key: authData.ussOAuth.key,
                                    value: new Row({
                                        value: authData.ussOAuth.value,
                                        eTag: BigInt(1),
                                    }),
                                }),
                            ],
                        });
                        yield new UnifiedStateSyncUpdate({
                            updateType: { case: "initialState", value: topic },
                        });
                    } else {
                        yield new UnifiedStateSyncUpdate({
                            updateType: { case: "initialState", value: new Topic({ data: [] }) },
                        });
                    }

                    // Keep stream alive
                    while (true) {
                        await new Promise(resolve => setTimeout(resolve, 30000));
                    }
                },

                async getChromeDevtoolsMcpUrl() {
                    const cdpPort = self.cdpPort || 9222;
                    try {
                        const mcpPort = await launchDevToolsMcp(cdpPort);
                        const mcpUrl = `http://127.0.0.1:${mcpPort}/mcp`;
                        if (self.verbose) console.log(`[MockExtSrv] getChromeDevtoolsMcpUrl returning ${mcpUrl}`);
                        return new GetChromeDevtoolsMcpUrlResponse({
                            url: mcpUrl
                        });
                    } catch (e) {
                        console.error("[MockExtSrv] Error launching MCP:", e);
                        return new GetChromeDevtoolsMcpUrlResponse();
                    }
                },

                fetchMCPAuthToken() {
                    return new FetchMCPAuthTokenResponse({ token: authData.apiKey });
                },

                logEvent() { return new LogEventResponse(); },
                recordError() { return new RecordErrorResponse(); },
                openFilePointer() { return new OpenFilePointerResponse(); },

                async launchBrowser() {
                    await self.ensureBrowserReady();
                    const cdpAddress = `http://127.0.0.1:${self.cdpPort}`;
                    if (self.verbose) console.log(`[MockExtSrv] LaunchBrowser requested, returning ${cdpAddress}`);
                    return new LaunchBrowserResponse({
                        cdpAddress: cdpAddress
                    });
                },

                checkTerminalShellSupport() {
                    const shellPath = process.env.SHELL || "/bin/sh";
                    const shellName = require("path").basename(shellPath);
                    if (self.verbose) console.log(`[MockExtSrv] CheckTerminalShellSupport requested, returning ${shellName}`);
                    return new CheckTerminalShellSupportResponse({
                        hasShellIntegration: true,
                        shellName: shellName,
                        shellPath: shellPath
                    });
                },

                pushUnifiedStateSyncUpdate() {
                    return new PushUnifiedStateSyncUpdateResponse();
                },

                async *executeCommand(req) {
                    if (self.verbose) console.log(`[MockExtSrv] ExecuteCommand requested: ${req.commandLine} in ${req.cwd}`);
                    yield new TerminalShellCommandStreamChunk({
                        value: {
                            case: "header",
                            value: new TerminalShellCommandHeader({
                                terminalId: req.terminalId || "mock-term",
                                commandLine: req.commandLine,
                                cwd: req.cwd,
                                shellPid: 0,
                                startTime: timestampBytes(),
                                source: TerminalShellCommandSource.CASCADE,
                            })
                        }
                    });

                    let proc;
                    try {
                        proc = spawn(req.commandLine, [], {
                            cwd: req.cwd || process.cwd(),
                            shell: true,
                        });
                    } catch (e: any) {
                        console.error("[MockExtSrv] Error spawning executeCommand:", e);
                        yield new TerminalShellCommandStreamChunk({
                            value: {
                                case: "trailer",
                                value: new TerminalShellCommandTrailer({
                                    exitCode: 1,
                                    endTime: timestampBytes()
                                })
                            }
                        });
                        return;
                    }

                    const queue: Buffer[] = [];
                    let resolveNext: (() => void) | null = null;
                    let finished = false;
                    let exitCode = 0;

                    const pushData = (data: Buffer) => {
                        queue.push(data);
                        if (resolveNext) resolveNext();
                    };

                    proc.stdout.on("data", pushData);
                    proc.stderr.on("data", pushData);
                    proc.on("error", (err: any) => {
                        pushData(Buffer.from(`\nError: ${err.message}`));
                    });

                    proc.on("close", (code) => {
                        exitCode = code || 0;
                        finished = true;
                        if (resolveNext) resolveNext();
                    });

                    while (!finished || queue.length > 0) {
                        if (queue.length > 0) {
                            const data = queue.shift()!;
                            yield new TerminalShellCommandStreamChunk({
                                value: {
                                    case: "data",
                                    value: new TerminalShellCommandData({
                                        rawData: new Uint8Array(data)
                                    })
                                }
                            });
                        } else {
                            await new Promise<void>(resolve => { resolveNext = resolve; });
                            resolveNext = null;
                        }
                    }

                    yield new TerminalShellCommandStreamChunk({
                        value: {
                            case: "trailer",
                            value: new TerminalShellCommandTrailer({
                                exitCode: exitCode,
                                endTime: timestampBytes()
                            })
                        }
                    });
                },

                smartFocusConversation() {
                    return new SmartFocusConversationResponse();
                },
            });
        }

        const handler = connectNodeAdapter({ routes });

        this.server = http.createServer((req, res) => {
            // Always log RPCs for debugging
            console.log(`[MockExtSrv] ${req.method} ${req.url}`);
            const origEnd = res.end.bind(res);
            res.end = function(...args: any[]) {
                if (res.statusCode !== 200) {
                    console.log(`[MockExtSrv] ⚠️  ${req.url} → status ${res.statusCode}`);
                }
                return origEnd(...args);
            } as any;
            handler(req, res);
        });

        return new Promise<number>((resolve, reject) => {
            this.server!.listen(this._port, "127.0.0.1", () => {
                const addr = this.server!.address();
                if (addr && typeof addr !== "string") {
                    this._port = addr.port;
                }
                resolve(this._port);
            });
            this.server!.on("error", reject);
        });
    }

    /**
     * Ensure a CDP-enabled Chrome is running and responsive.
     * Can be called before LS startup to avoid "no browser session" errors.
     */
    async ensureBrowserReady(): Promise<boolean> {
        if (this._browserReady) return true;

        const cdpPort = this.cdpPort;

        // First check if Chrome is already listening on CDP port
        const alreadyRunning = await this.pollCdp(cdpPort, 1000);
        if (alreadyRunning) {
            if (this.verbose) console.log(`[MockExtSrv] Chrome already responsive on CDP port ${cdpPort}`);
            this._browserReady = true;
            return true;
        }

        // Spawn Chrome with CDP flags
        const userDataDir = path.join(os.homedir(), ".gemini", "antigravity-browser-profile");
        const chromeFlags = [
            `--remote-debugging-port=${cdpPort}`,
            `--user-data-dir=${userDataDir}`,
            "--disable-fre",
            "--no-default-browser-check",
            "--no-first-run",
            "--auto-accept-browser-signin-for-tests",
            "--ash-no-nudges",
            "--disable-features=OfferMigrationToDiceUsers,OptGuideOnDeviceModel",
            "about:blank"
        ];

        const chromePaths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/usr/bin/google-chrome"
        ];
        const chromePath = chromePaths.find(p => fs.existsSync(p));

        if (!chromePath) {
            console.error("[MockExtSrv] Chrome binary not found!");
            return false;
        }

        try {
            if (this.verbose) console.log(`[MockExtSrv] Pre-launching Chrome (CDP port ${cdpPort})...`);
            if (process.platform === "darwin") {
                spawn("open", ["--new", "--background", "-a", chromePath, "--args", ...chromeFlags], {
                    detached: true,
                    stdio: "ignore",
                    shell: false
                });
            } else {
                spawn(chromePath, chromeFlags, {
                    detached: true,
                    stdio: "ignore",
                    shell: false
                });
            }

            this._browserReady = await this.pollCdp(cdpPort, 20000);
            if (this._browserReady) {
                if (this.verbose) console.log(`[MockExtSrv] ✅ Chrome ready on CDP port ${cdpPort}`);
            } else {
                console.warn(`[MockExtSrv] ⚠️ Chrome startup timed out on port ${cdpPort}`);
            }
        } catch (e) {
            console.error(`[MockExtSrv] Error spawning Chrome:`, e);
        }

        return this._browserReady;
    }

    /**
     * Poll CDP /json/version until responsive or timeout.
     */
    private async pollCdp(port: number, timeoutMs: number): Promise<boolean> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            try {
                await new Promise<void>((resolve, reject) => {
                    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
                        if (res.statusCode === 200) resolve();
                        else reject();
                        res.resume();
                    });
                    req.on("error", reject);
                    req.setTimeout(500, () => req.destroy());
                });
                return true;
            } catch (e) {
                await new Promise(r => setTimeout(r, 200));
            }
        }
        return false;
    }

    /**
     * Stop the mock server.
     */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }
}
