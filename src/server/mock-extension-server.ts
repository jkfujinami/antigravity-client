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
import { ExtensionServerService } from "../gen/exa/extension_server_pb_connect.js";
import {
    LanguageServerStartedResponse,
    GetChromeDevtoolsMcpUrlResponse,
    FetchMCPAuthTokenResponse,
    UnifiedStateSyncUpdate,
    LogEventResponse,
    RecordErrorResponse,
    OpenFilePointerResponse,
} from "../gen/exa/extension_server_pb_pb.js";
import { Topic, Row } from "../gen/exa/unified_state_sync_pb_pb.js";
import * as http from "http";
import { EventEmitter } from "events";
import { readAuthData, type AuthData } from "./auth-reader.js";

export interface MockServerOptions {
    port?: number;         // Default: 0 (random)
    authData?: AuthData;   // If not provided, reads from state.vscdb
    verbose?: boolean;     // Log all requests
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
    private _port: number;
    private _lsInfo: LsInfo = { httpsPort: 0, httpPort: 0, lspPort: 0, csrfToken: "" };

    constructor(options: MockServerOptions = {}) {
        super();
        this._port = options.port ?? 0;
        this.verbose = options.verbose ?? false;
        this.authData = options.authData ?? readAuthData();
    }

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
                            data: {
                                [authData.ussOAuth.key]: new Row({
                                    value: authData.ussOAuth.value,
                                    eTag: BigInt(1),
                                }),
                            },
                        });
                        yield new UnifiedStateSyncUpdate({
                            updateType: { case: "initialState", value: topic },
                        });
                    } else {
                        yield new UnifiedStateSyncUpdate({
                            updateType: { case: "initialState", value: new Topic({ data: {} }) },
                        });
                    }

                    // Keep stream alive
                    while (true) {
                        await new Promise(resolve => setTimeout(resolve, 30000));
                    }
                },

                getChromeDevtoolsMcpUrl() {
                    return new GetChromeDevtoolsMcpUrlResponse();
                },

                fetchMCPAuthToken() {
                    return new FetchMCPAuthTokenResponse({ token: authData.apiKey });
                },

                logEvent() { return new LogEventResponse(); },
                recordError() { return new RecordErrorResponse(); },
                openFilePointer() { return new OpenFilePointerResponse(); },
            });
        }

        const handler = connectNodeAdapter({ routes });

        this.server = http.createServer((req, res) => {
            if (this.verbose) {
                console.log(`[MockExtSrv] ${req.method} ${req.url}`);
            }
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
