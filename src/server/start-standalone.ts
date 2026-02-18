/**
 * Standalone Independent LS Starter
 *
 * Usage: npx tsx src/server/start-standalone.ts [workspacePath]
 */
import { Launcher } from "./launcher.js";
import * as path from "path";

async function main() {
    const workspacePath = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
    console.log(`🚀 Starting independent LS for workspace: ${workspacePath}`);

    try {
        const launcher = await Launcher.start({
            workspacePath,
            verbose: true,
        });

        console.log("\n✅ LS Running!");
        console.log(`   PID:        ${launcher.pid}`);
        console.log(`   HTTPS Port: ${launcher.httpsPort} (Connect RPC)`);
        console.log(`   HTTP Port:  ${launcher.httpPort}`);
        console.log(`   CSRF Token: ${launcher.csrfToken}`);
        console.log("\nPress Ctrl+C to stop.");

        // Keep process alive based on LS process
        // Launcher handles child process exit
        launcher.on("exit", (code) => {
            console.log(`\n[Launcher] LS exited with code ${code}. Exiting.`);
            process.exit(code || 0);
        });

        // Handle Ctrl+C
        process.on("SIGINT", async () => {
            console.log("\n🛑 Stopping LS...");
            await launcher.stop();
            console.log("✅ LS stopped.");
            process.exit(0);
        });

    } catch (e: any) {
        console.error("❌ Failed to start LS:", e);
        process.exit(1);
    }
}

main();
