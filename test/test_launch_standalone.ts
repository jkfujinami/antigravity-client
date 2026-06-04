/**
 * Test that launches the Antigravity LS standalone, fetches user info, then
 * cleanly stops and shuts down the LS.
 */
import { AntigravityClient } from "../src/index.js";

async function main() {
    console.log("🚀 Launching standalone Antigravity Language Server...");
    try {
        const client = await AntigravityClient.launch({
            workspacePath: process.cwd(),
            verbose: false, // avoid flooding the console with logs
        });
        
        console.log(`✅ LS running (PID: ${client.launcher.pid}, HTTPS: ${client.launcher.httpsPort})`);

        console.log("📡 Fetching User Status...");
        const status = await client.getUserStatus();
        const us = status.userStatus;
        
        console.log("--------------------------------------------------");
        console.log(`👤 Name : ${us?.name || "N/A"}`);
        console.log(`✉️  Email: ${us?.email || "N/A"}`);
        console.log("--------------------------------------------------");

        console.log("🛑 Stopping Language Server...");
        await client.launcher.stop();
        console.log("🏁 Test completed cleanly. LS stopped.");
        
    } catch (e: unknown) {
        console.error("❌ Launch failed:", (e as Error).message);
    }
}

main();
