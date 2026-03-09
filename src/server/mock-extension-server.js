"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockExtensionServer = void 0;
var connect_node_1 = require("@connectrpc/connect-node");
var extension_server_pb_connect_js_1 = require("../gen/exa/extension_server_pb_connect.js");
var extension_server_pb_pb_js_1 = require("../gen/exa/extension_server_pb_pb.js");
var unified_state_sync_pb_pb_js_1 = require("../gen/exa/unified_state_sync_pb_pb.js");
var http = require("http");
var events_1 = require("events");
var child_process_1 = require("child_process");
var os = require("os");
var path = require("path");
var fs = require("fs");
var auth_reader_js_1 = require("./auth-reader.js");
var launcher_mcp_js_1 = require("./launcher_mcp.js");
var MockExtensionServer = /** @class */ (function (_super) {
    __extends(MockExtensionServer, _super);
    function MockExtensionServer(options) {
        if (options === void 0) { options = {}; }
        var _a, _b, _c, _d;
        var _this = _super.call(this) || this;
        _this.server = null;
        _this._lsInfo = { httpsPort: 0, httpPort: 0, lspPort: 0, csrfToken: "" };
        _this._port = (_a = options.port) !== null && _a !== void 0 ? _a : 0;
        _this.verbose = (_b = options.verbose) !== null && _b !== void 0 ? _b : false;
        _this.cdpPort = (_c = options.cdpPort) !== null && _c !== void 0 ? _c : 9222;
        _this.authData = (_d = options.authData) !== null && _d !== void 0 ? _d : (0, auth_reader_js_1.readAuthData)();
        return _this;
    }
    Object.defineProperty(MockExtensionServer.prototype, "port", {
        get: function () { return this._port; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MockExtensionServer.prototype, "lsInfo", {
        get: function () { return this._lsInfo; },
        enumerable: false,
        configurable: true
    });
    /**
     * Start the mock server. Returns the actual listening port.
     */
    MockExtensionServer.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            function routes(router) {
                router.service(extension_server_pb_connect_js_1.ExtensionServerService, {
                    languageServerStarted: function (req) {
                        self._lsInfo = {
                            httpsPort: req.httpsPort,
                            httpPort: req.httpPort,
                            lspPort: req.lspPort,
                            csrfToken: req.csrfToken,
                        };
                        self.emit("ls-started", self._lsInfo);
                        return new extension_server_pb_pb_js_1.LanguageServerStartedResponse();
                    },
                    subscribeToUnifiedStateSyncTopic: function (req) {
                        return __asyncGenerator(this, arguments, function subscribeToUnifiedStateSyncTopic_1() {
                            var topic;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if (!(req.topic === "uss-oauth")) return [3 /*break*/, 3];
                                        topic = new unified_state_sync_pb_pb_js_1.Topic({
                                            data: (_a = {},
                                                _a[authData.ussOAuth.key] = new unified_state_sync_pb_pb_js_1.Row({
                                                    value: authData.ussOAuth.value,
                                                    eTag: BigInt(1),
                                                }),
                                                _a),
                                        });
                                        return [4 /*yield*/, __await(new extension_server_pb_pb_js_1.UnifiedStateSyncUpdate({
                                                updateType: { case: "initialState", value: topic },
                                            }))];
                                    case 1: return [4 /*yield*/, _b.sent()];
                                    case 2:
                                        _b.sent();
                                        return [3 /*break*/, 6];
                                    case 3: return [4 /*yield*/, __await(new extension_server_pb_pb_js_1.UnifiedStateSyncUpdate({
                                            updateType: { case: "initialState", value: new unified_state_sync_pb_pb_js_1.Topic({ data: {} }) },
                                        }))];
                                    case 4: return [4 /*yield*/, _b.sent()];
                                    case 5:
                                        _b.sent();
                                        _b.label = 6;
                                    case 6:
                                        if (!true) return [3 /*break*/, 8];
                                        return [4 /*yield*/, __await(new Promise(function (resolve) { return setTimeout(resolve, 30000); }))];
                                    case 7:
                                        _b.sent();
                                        return [3 /*break*/, 6];
                                    case 8: return [2 /*return*/];
                                }
                            });
                        });
                    },
                    getChromeDevtoolsMcpUrl: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var cdpPort, mcpPort, mcpUrl, e_1;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        cdpPort = self.cdpPort || 9222;
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, (0, launcher_mcp_js_1.launchDevToolsMcp)(cdpPort)];
                                    case 2:
                                        mcpPort = _a.sent();
                                        mcpUrl = "http://127.0.0.1:".concat(mcpPort, "/mcp");
                                        if (self.verbose)
                                            console.log("[MockExtSrv] getChromeDevtoolsMcpUrl returning ".concat(mcpUrl));
                                        return [2 /*return*/, new extension_server_pb_pb_js_1.GetChromeDevtoolsMcpUrlResponse({
                                                url: mcpUrl
                                            })];
                                    case 3:
                                        e_1 = _a.sent();
                                        console.error("[MockExtSrv] Error launching MCP:", e_1);
                                        return [2 /*return*/, new extension_server_pb_pb_js_1.GetChromeDevtoolsMcpUrlResponse()];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        });
                    },
                    fetchMCPAuthToken: function () {
                        return new extension_server_pb_pb_js_1.FetchMCPAuthTokenResponse({ token: authData.apiKey });
                    },
                    logEvent: function () { return new extension_server_pb_pb_js_1.LogEventResponse(); },
                    recordError: function () { return new extension_server_pb_pb_js_1.RecordErrorResponse(); },
                    openFilePointer: function () { return new extension_server_pb_pb_js_1.OpenFilePointerResponse(); },
                    launchBrowser: function () {
                        return __awaiter(this, void 0, void 0, function () {
                            var cdpPort, cdpAddress, userDataDir, chromeFlags, chromePaths, chromePath, e_2;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        cdpPort = self.cdpPort;
                                        cdpAddress = "http://127.0.0.1:".concat(cdpPort);
                                        userDataDir = path.join(os.homedir(), ".gemini", "antigravity-browser-profile");
                                        chromeFlags = [
                                            "--remote-debugging-port=".concat(cdpPort),
                                            "--user-data-dir=".concat(userDataDir),
                                            "--disable-fre",
                                            "--no-default-browser-check",
                                            "--no-first-run",
                                            "--auto-accept-browser-signin-for-tests",
                                            "--ash-no-nudges",
                                            "--disable-features=OfferMigrationToDiceUsers,OptGuideOnDeviceModel"
                                        ];
                                        chromePaths = [
                                            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                                            "/usr/bin/google-chrome"
                                        ];
                                        chromePath = chromePaths.find(function (p) { return fs.existsSync(p); });
                                        if (!chromePath) return [3 /*break*/, 4];
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        if (self.verbose)
                                            console.log("[MockExtSrv] Spawning Chrome from ".concat(chromePath, " with flags..."));
                                        if (process.platform === "darwin") {
                                            (0, child_process_1.spawn)("open", __spreadArray(["-n", "-a", chromePath, "--args"], chromeFlags, true), {
                                                detached: true,
                                                stdio: "ignore",
                                                shell: false
                                            });
                                        }
                                        else {
                                            (0, child_process_1.spawn)(chromePath, chromeFlags, {
                                                detached: true,
                                                stdio: "ignore",
                                                shell: false
                                            });
                                        }
                                        // Simple delay to let it bind
                                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                                    case 2:
                                        // Simple delay to let it bind
                                        _a.sent();
                                        return [3 /*break*/, 4];
                                    case 3:
                                        e_2 = _a.sent();
                                        console.error("[MockExtSrv] Error spawning Chrome:", e_2);
                                        return [3 /*break*/, 4];
                                    case 4:
                                        if (self.verbose)
                                            console.log("[MockExtSrv] LaunchBrowser requested, returning ".concat(cdpAddress));
                                        return [2 /*return*/, new extension_server_pb_pb_js_1.LaunchBrowserResponse({
                                                cdpAddress: cdpAddress
                                            })];
                                }
                            });
                        });
                    },
                    checkTerminalShellSupport: function () {
                        var shellPath = process.env.SHELL || "/bin/sh";
                        var shellName = require("path").basename(shellPath);
                        if (self.verbose)
                            console.log("[MockExtSrv] CheckTerminalShellSupport requested, returning ".concat(shellName));
                        return new extension_server_pb_pb_js_1.CheckTerminalShellSupportResponse({
                            hasShellIntegration: true,
                            shellName: shellName,
                            shellPath: shellPath
                        });
                    },
                    pushUnifiedStateSyncUpdate: function () {
                        return new extension_server_pb_pb_js_1.PushUnifiedStateSyncUpdateResponse();
                    },
                });
            }
            var self, authData, handler;
            var _this = this;
            return __generator(this, function (_a) {
                self = this;
                authData = this.authData;
                handler = (0, connect_node_1.connectNodeAdapter)({ routes: routes });
                this.server = http.createServer(function (req, res) {
                    if (_this.verbose) {
                        console.log("[MockExtSrv] ".concat(req.method, " ").concat(req.url));
                    }
                    handler(req, res);
                });
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.server.listen(_this._port, "127.0.0.1", function () {
                            var addr = _this.server.address();
                            if (addr && typeof addr !== "string") {
                                _this._port = addr.port;
                            }
                            resolve(_this._port);
                        });
                        _this.server.on("error", reject);
                    })];
            });
        });
    };
    /**
     * Stop the mock server.
     */
    MockExtensionServer.prototype.stop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        if (_this.server) {
                            _this.server.close(function () { return resolve(); });
                        }
                        else {
                            resolve();
                        }
                    })];
            });
        });
    };
    return MockExtensionServer;
}(events_1.EventEmitter));
exports.MockExtensionServer = MockExtensionServer;
