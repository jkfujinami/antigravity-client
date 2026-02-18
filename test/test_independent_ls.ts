/**
 * Test: Independent LS via Launcher
 *
 * Launches an independent LS, connects to it, calls getUserStatus, then stops.
 */
import { AntigravityClient } from "../src/client.js";

async function main() {
    console.log("🚀 Launching independent LS...");

    const client = await AntigravityClient.launch({
        workspacePath: process.cwd(),
        verbose: true,
    });

    console.log(`\n✅ LS running (PID: ${client.launcher.pid}, HTTPS: ${client.launcher.httpsPort})`);

    try {
        console.log("\n📡 getUserStatus...");
        const status = await client.getUserStatus();
        const us = status.userStatus as any;
        console.log(`   Name:  ${us?.name || "N/A"}`);
        console.log(`   Email: ${us?.email || "N/A"}`);
        console.log(`   Tier:  ${us?.userTier?.name || "N/A"}`);

        console.log("\n📡 getWorkingDirectories...");
        const dirs = await client.getWorkingDirectories();
        console.log(`   Dirs: ${JSON.stringify(dirs.directories)}`);

        console.log("\n🎉 Independent LS test PASSED!");
    } catch (e: any) {
        console.error(`\n❌ Error [${e.code}]:`, e.message?.substring(0, 200));
    } finally {
        console.log("\n🛑 Stopping LS...");
        await client.launcher.stop();
        console.log("✅ LS stopped.");
    }
}

main();
