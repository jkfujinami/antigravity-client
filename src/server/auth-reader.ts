/**
 * Auth Reader - Reads authentication data from Antigravity's state.vscdb
 *
 * Provides OAuth tokens and USS data needed by the Mock Extension Server
 * and the Launcher to authenticate independent LS instances.
 */
import Database from "better-sqlite3";
import { homedir } from "os";
import * as path from "path";
import * as fs from "fs";
import { Topic } from "../gen/exa/unified_state_sync_pb/unified_state_sync_pb.js";
import { OAuthTokenInfo } from "../gen/exa/language_server_pb/language_server_pb.js";

/**
 * Per-OS base directory that holds VSCode-style app profiles (…/<AppName>/User/…).
 */
function profileBaseDir(): string {
    return process.platform === "darwin"
        ? path.join(homedir(), "Library", "Application Support")
        : process.platform === "win32"
        ? (process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"))
        : path.join(homedir(), ".config");
}

/**
 * Candidate state.vscdb paths, in preference order.
 *
 * Antigravity ships as two products that store auth in SEPARATE profile folders:
 *   - "Antigravity"      → the standalone app (Electron, productName "Antigravity")
 *   - "Antigravity IDE"  → the IDE (VSCode fork, nameShort "Antigravity IDE")
 * A user may be logged into either, so we probe both on every platform.
 */
function stateDbCandidates(): string[] {
    const base = profileBaseDir();
    return ["Antigravity", "Antigravity IDE"].map(
        name => path.join(base, name, "User", "globalStorage", "state.vscdb"),
    );
}

/** True if this DB holds a non-empty OAuth token (the real, durable credential). */
function dbHasOAuthToken(dbPath: string): boolean {
    try {
        const db = new Database(dbPath, { readonly: true });
        try {
            const row = db.prepare("SELECT value FROM ItemTable WHERE key='antigravityUnifiedStateSync.oauthToken'").get() as { value: string } | undefined;
            if (!row) return false;
            const topic = Topic.fromBinary(Buffer.from(row.value, "base64"));
            const entry = topic.data.find(e => e.key === "oauthTokenInfoSentinelKey");
            return !!entry?.value?.value;
        } finally {
            db.close();
        }
    } catch {
        return false;
    }
}

/**
 * Resolve which state.vscdb to read.
 * Priority: AG_STATE_DB override → first candidate that actually has an OAuth token
 * → first candidate that exists → the standalone path (so errors stay meaningful).
 */
function resolveStateDbPath(): string {
    const override = process.env.AG_STATE_DB?.trim();
    if (override) return override;
    const candidates = stateDbCandidates();
    return (
        candidates.find(p => fs.existsSync(p) && dbHasOAuthToken(p)) ??
        candidates.find(p => fs.existsSync(p)) ??
        candidates[0]
    );
}

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
 * Read the standalone Antigravity app's convenience cache (`antigravityAuthStatus`).
 *
 * NOTE: this key is written ONLY by the standalone Antigravity app, not by the
 * Antigravity IDE (VSCode fork). Its `apiKey` is a short-lived `ya29.` access
 * token cached as a side-effect — it may be absent (IDE profile) or expired. It
 * is therefore NOT a reliable auth source; we use it only as a best-effort source
 * of email/name. The authoritative credential is the OAuth token (see below).
 */
function readLegacyAuthStatus(): { apiKey: string; email: string; name: string } {
    try {
        const db = new Database(resolveStateDbPath(), { readonly: true });
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
 * Decode the stored `OAuthTokenInfo` (refresh token, access token, expiry, ...).
 *
 * Mirrors the real client's `OAuthPreferences.getOAuthTokenInfo()`: the durable
 * credential lives in the USS `oauthToken` topic under `oauthTokenInfoSentinelKey`,
 * present in BOTH standalone and IDE profiles. Returns null if not logged in.
 */
export function getOAuthTokenInfo(): OAuthTokenInfo | null {
    const uss = readUssOAuthData();
    if (!uss.value) return null;
    try {
        return OAuthTokenInfo.fromBinary(Buffer.from(uss.value, "base64"));
    } catch {
        return null;
    }
}

/**
 * Read the auth status used by the rest of the client.
 *
 * `apiKey` is derived from `OAuthTokenInfo.accessToken` — exactly what the real
 * client does (`metadata.apiKey = getOAuthTokenInfo()?.accessToken ?? ""`). This
 * works on every profile (standalone/IDE, mac/win/linux) and does not depend on
 * the optional `antigravityAuthStatus` cache. email/name are best-effort from the
 * legacy cache (absent on IDE profiles — fine, they are display-only).
 */
export function readAuthStatus(): { apiKey: string; email: string; name: string } {
    const info = getOAuthTokenInfo();
    const apiKey = info?.accessToken ?? "";
    const legacy = readLegacyAuthStatus();
    return {
        apiKey: apiKey || legacy.apiKey,
        email: legacy.email,
        name: legacy.name,
    };
}

/**
 * Read USS OAuth topic data from state.vscdb.
 * This is the data the LS expects to receive via SubscribeToUnifiedStateSyncTopic("uss-oauth").
 */
export function readUssOAuthData(): UssOAuthData {
    try {
        const db = new Database(resolveStateDbPath(), { readonly: true });
        try {
            const row = db.prepare("SELECT value FROM ItemTable WHERE key='antigravityUnifiedStateSync.oauthToken'").get() as { value: string } | undefined;
            if (!row) return { key: "oauthTokenInfoSentinelKey", value: "" };

            const topicBytes = Buffer.from(row.value, "base64");
            const topic = Topic.fromBinary(topicBytes);

            // Select by key name — NOT data[0]. The entry order differs between
            // profiles (e.g. the IDE profile lists authStateWithContextSentinelKey
            // first), so indexing blindly grabs the wrong entry.
            const entry = topic.data.find(e => e.key === "oauthTokenInfoSentinelKey");
            if (entry) {
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
