/**
 * Chrome DevTools MCP Launcher (stub)
 *
 * Launches a Chrome DevTools MCP server proxying a CDP endpoint.
 * This is used by the Mock Extension Server for browser integration.
 */

export async function launchDevToolsMcp(cdpPort: number): Promise<number> {
    // Stub: In production, this would launch the actual MCP server.
    // For now, return a fixed port or throw to indicate it's not available.
    // Not configured — caller handles the error
    throw new Error("Chrome DevTools MCP launcher not configured");
}
