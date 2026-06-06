#!/usr/bin/env node
/**
 * Antigravity MCP Server
 *
 * Wraps an Antigravity Language Server as an MCP server (stdio transport) so a
 * host agent (e.g. Claude Code) can delegate search / reasoning to Antigravity
 * Cascades without polluting or blocking its own context.
 *
 * Connection model: standalone — this process `launch()`es its own independent
 * Language Server (no running Antigravity IDE required) and stops it on exit.
 *
 * Register with Claude Code:
 *   claude mcp add antigravity -- node /abs/path/dist/src/server/mcp_server.js
 *
 * Env:
 *   ANTIGRAVITY_MCP_WORKSPACE  workspace path the LS should track (default: cwd)
 *   ANTIGRAVITY_API_KEY        API key (falls back to ~/.codeium auth)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AntigravityClient } from "../core/client.js";
import { CascadeRegistry } from "./mcp/registry.js";
import { registerTools } from "./mcp/tools.js";

async function main(): Promise<void> {
    // stdio transport owns stdout for JSON-RPC framing. Anything that would
    // otherwise console.log (the client/launcher do) must go to stderr instead,
    // or it corrupts the protocol stream. Redirect before launching the LS.
    console.log = (...args: any[]) => console.error(...args);
    console.info = (...args: any[]) => console.error(...args);

    const workspacePath = process.env.ANTIGRAVITY_MCP_WORKSPACE || process.cwd();
    console.error(`[mcp] launching standalone Antigravity LS (workspace: ${workspacePath})…`);

    const client = await AntigravityClient.launch({ workspacePath });

    // Connectivity / auth sanity check (non-fatal — surfaced per-tool otherwise).
    try {
        await client.getUserStatus();
        console.error("[mcp] LS authenticated.");
    } catch (e: any) {
        console.error(`[mcp] warning: getUserStatus failed (auth?): ${e?.message ?? e}`);
    }

    const registry = new CascadeRegistry(client);
    const server = new McpServer({ name: "antigravity", version: "1.0.0" });
    registerTools(server, client, registry);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("[mcp] antigravity MCP server ready on stdio.");

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.error(`[mcp] received ${signal}, shutting down…`);
        try {
            client.dispose();
        } catch {
            /* ignore */
        }
        try {
            await client.launcher.stop();
        } catch {
            /* ignore */
        }
        process.exit(0);
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
    console.error("[mcp] fatal:", e);
    process.exit(1);
});
