"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readAuthStatus = readAuthStatus;
exports.readUssOAuthData = readUssOAuthData;
exports.readAuthData = readAuthData;
/**
 * Auth Reader - Reads authentication data from Antigravity's state.vscdb
 *
 * Provides OAuth tokens and USS data needed by the Mock Extension Server
 * and the Launcher to authenticate independent LS instances.
 */
var child_process_1 = require("child_process");
var os_1 = require("os");
var path = require("path");
var unified_state_sync_pb_pb_js_1 = require("../gen/exa/unified_state_sync_pb_pb.js");
var STATE_DB_PATH = path.join((0, os_1.homedir)(), "Library/Application Support/Antigravity/User/globalStorage/state.vscdb");
/**
 * Read the full auth status from state.vscdb
 */
function readAuthStatus() {
    try {
        var result = (0, child_process_1.execSync)("sqlite3 \"".concat(STATE_DB_PATH, "\" \"SELECT value FROM ItemTable WHERE key='antigravityAuthStatus'\""), { encoding: "utf8" }).trim();
        var parsed = JSON.parse(result);
        return {
            apiKey: parsed.apiKey || "",
            email: parsed.email || "",
            name: parsed.name || "",
        };
    }
    catch (_a) {
        return { apiKey: "", email: "", name: "" };
    }
}
/**
 * Read USS OAuth topic data from state.vscdb.
 * This is the data the LS expects to receive via SubscribeToUnifiedStateSyncTopic("uss-oauth").
 */
function readUssOAuthData() {
    try {
        var raw = (0, child_process_1.execSync)("sqlite3 \"".concat(STATE_DB_PATH, "\" \"SELECT value FROM ItemTable WHERE key='antigravityUnifiedStateSync.oauthToken'\""), { encoding: "utf8" }).trim();
        var topicBytes = Buffer.from(raw, "base64");
        var topic = unified_state_sync_pb_pb_js_1.Topic.fromBinary(topicBytes);
        var entries = Object.entries(topic.data);
        if (entries.length > 0) {
            var _a = entries[0], key = _a[0], row = _a[1];
            return { key: key, value: row.value };
        }
        return { key: "oauthTokenInfoSentinelKey", value: "" };
    }
    catch (_b) {
        return { key: "oauthTokenInfoSentinelKey", value: "" };
    }
}
/**
 * Read all auth data needed for independent LS operation.
 */
function readAuthData() {
    var status = readAuthStatus();
    var ussOAuth = readUssOAuthData();
    return __assign(__assign({}, status), { ussOAuth: ussOAuth });
}
