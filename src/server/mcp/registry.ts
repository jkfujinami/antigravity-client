/**
 * CascadeRegistry
 *
 * Tracks the Cascades this MCP server has started, so async tasks can be
 * checked / fed / disposed by `cascadeId` across multiple MCP tool calls.
 *
 * The registry lives in the MCP-server process memory. If the process is
 * restarted the map is empty, but cascades usually survive on the Language
 * Server side — `resolve()` transparently falls back to `resumeCascade()` so a
 * known `cascadeId` keeps working across restarts.
 */
import type { AntigravityClient } from "../../core/client.js";
import type { Cascade } from "../../core/cascade/index.js";
import { toRunStatus, type RunStatus } from "../../types/index.js";
import { CascadeRunStatus } from "../../gen/exa/cortex_pb/cortex_pb.js";

/** Max time to wait for a best-effort cancel during remove() before disposing. */
const CANCEL_TIMEOUT_MS = 5_000;

export interface CascadeEntry {
    cascade: Cascade;
    title: string;
    createdAt: number;
    lastTouchedAt: number;
}

export interface CascadeInfo {
    cascadeId: string;
    title: string;
    status: RunStatus;
    ageSec: number;
    idleSec: number;
}

export class CascadeRegistry {
    private entries = new Map<string, CascadeEntry>();

    constructor(private client: AntigravityClient) {}

    /** Registers a freshly started cascade. */
    add(cascade: Cascade, title: string): CascadeEntry {
        const now = Date.now();
        const entry: CascadeEntry = { cascade, title, createdAt: now, lastTouchedAt: now };
        this.entries.set(cascade.cascadeId, entry);
        return entry;
    }

    get(id: string): CascadeEntry | undefined {
        return this.entries.get(id);
    }

    /** Bumps the last-activity timestamp (used to compute idle age). */
    touch(id: string): void {
        const e = this.entries.get(id);
        if (e) e.lastTouchedAt = Date.now();
    }

    /**
     * Returns the registered entry for `id`. If it isn't in memory (e.g. the MCP
     * server restarted), resumes the cascade from the Language Server and
     * registers it. Throws if the cascade is missing/expired on the LS too.
     */
    async resolve(id: string): Promise<CascadeEntry> {
        const existing = this.entries.get(id);
        if (existing) return existing;
        const cascade = await this.client.resumeCascade(id);
        return this.add(cascade, "(resumed)");
    }

    /** Snapshot of every tracked cascade and its current run status. */
    list(): CascadeInfo[] {
        const now = Date.now();
        return [...this.entries.values()].map((e) => ({
            cascadeId: e.cascade.cascadeId,
            title: e.title,
            status: toRunStatus(e.cascade.state.status),
            ageSec: Math.round((now - e.createdAt) / 1000),
            idleSec: Math.round((now - e.lastTouchedAt) / 1000),
        }));
    }

    /**
     * Archives a cascade: cancels the in-flight turn (if any), releases the
     * local update stream, and drops it from the registry.
     *
     * Note: there is no server-side "delete cascade" RPC — the cascade may still
     * exist on the LS. This only frees the resources this MCP server holds.
     */
    async remove(id: string): Promise<boolean> {
        const entry = this.entries.get(id);
        if (!entry) return false;

        const status = entry.cascade.state.status;
        if (status === CascadeRunStatus.RUNNING || status === CascadeRunStatus.BUSY) {
            // best-effort cancel; the RPC can hang if the LS is wedged, so bound
            // it with a timeout and proceed to dispose regardless.
            await Promise.race([
                entry.cascade.cancel().catch(() => {}),
                new Promise<void>((resolve) => setTimeout(resolve, CANCEL_TIMEOUT_MS)),
            ]);
        }
        try {
            entry.cascade.dispose();
        } catch {
            // ignore disposal errors
        }
        this.entries.delete(id);
        return true;
    }
}
