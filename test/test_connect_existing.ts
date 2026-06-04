/**
 * Simple test that connects to an existing Antigravity LS process, fetches
 * user info (getUserStatus), and exits.
 */
import { AntigravityClient } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to existing Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        console.log("✅ Connected successfully!");

        console.log("📡 Fetching User Status...");
        const status = await client.getUserStatus();
        const us = status.userStatus;
        
        console.log("--------------------------------------------------");
        console.log(`👤 Name : ${us?.name || "N/A"}`);
        console.log(`✉️  Email: ${us?.email || "N/A"}`);
        console.log(`👑 Tier : ${us?.userTier?.name || "N/A"}`);
        console.log("--------------------------------------------------");

        console.log("🏁 Test completed cleanly.");
        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Connection failed:", (e as Error).message);
    }
}

main();
