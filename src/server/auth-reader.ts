/**
 * Auth Reader - Reads authentication data from Antigravity's state.vscdb
 *
 * Provides OAuth tokens and USS data needed by the Mock Extension Server
 * and the Launcher to authenticate independent LS instances.
 */
import Database from "better-sqlite3";
import { homedir } from "os";
import * as path from "path";
import { Topic } from "../gen/exa/unified_state_sync_pb/unified_state_sync_pb.js";

const STATE_DB_PATH = process.platform === "darwin"
    ? path.join(homedir(), "Library/Application Support/Antigravity/User/globalStorage/state.vscdb")
    : process.platform === "win32"
    ? path.join(process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"), "Antigravity", "User", "globalStorage", "state.vscdb")
    : path.join(homedir(), ".config/Antigravity/User/globalStorage/state.vscdb");

export interface UssOAuthData {
    key: string;      // USS data map key (e.g. "oauthTokenInfoSentinelKey")
    value: string;    // Base64-encoded OAuthTokenInfo protobuf
}

export interface AuthData {
    apiKey: string;        // Google OAuth access token (ya29.xxx)
    email: string;
    name: string;
    ussOAuth: UssOAuthData;
}

/**
 * Read the full auth status from state.vscdb
 */
export function readAuthStatus(): { apiKey: string; email: string; name: string } {
    try {
        const db = new Database(STATE_DB_PATH, { readonly: true });
        try {
            const row = db.prepare("SELECT value FROM ItemTable WHERE key='antigravityAuthStatus'").get() as { value: string } | undefined;
            if (!row) return { apiKey: "", email: "", name: "" };
            const parsed = JSON.parse(row.value);
            return {
                apiKey: parsed.apiKey || "",
                email: parsed.email || "",
                name: parsed.name || "",
            };
        } finally {
            db.close();
        }
    } catch {
        return { apiKey: "", email: "", name: "" };
    }
}

/**
 * Read USS OAuth topic data from state.vscdb.
 * This is the data the LS expects to receive via SubscribeToUnifiedStateSyncTopic("uss-oauth").
 */
export function readUssOAuthData(): UssOAuthData {
    try {
        const db = new Database(STATE_DB_PATH, { readonly: true });
        try {
            const row = db.prepare("SELECT value FROM ItemTable WHERE key='antigravityUnifiedStateSync.oauthToken'").get() as { value: string } | undefined;
            if (!row) return { key: "oauthTokenInfoSentinelKey", value: "" };

            const topicBytes = Buffer.from(row.value, "base64");
            const topic = Topic.fromBinary(topicBytes);

            if (topic.data.length > 0) {
                const entry = topic.data[0];
                return { key: entry.key, value: entry.value?.value || "" };
            }

            return { key: "oauthTokenInfoSentinelKey", value: "" };
        } finally {
            db.close();
        }
    } catch {
        return { key: "oauthTokenInfoSentinelKey", value: "" };
    }
}

/**
 * Read all auth data needed for independent LS operation.
 */
export function readAuthData(): AuthData {
    const status = readAuthStatus();
    const ussOAuth = readUssOAuthData();
    return { ...status, ussOAuth };
}
