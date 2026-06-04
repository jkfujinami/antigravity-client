/**
 * Test that connects to an existing LS and fetches the list of past cascade (chat thread) histories.
 */
import { AntigravityClient } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("📂 Fetching all cascade summaries...");
        // Fetch directly via lsClient (the raw gRPC wrapper)
        const cascades = await client.languageServer.getAllCascadeTrajectories({});

        const summaries = cascades.trajectorySummaries || [];
        
        console.log("--------------------------------------------------");
        console.log(`✨ Found ${summaries.length} Active Cascades:`);
        
        // Show only the 5 most recent
        const recent = summaries.slice(-5);
        for (const entry of recent) {
            const id = entry.key;
            const summary = entry.value;
            const rootId = summary?.trajectoryId || "N/A";
            const lastUpdated = summary?.lastModifiedTime ? 
                new Date(Number(summary.lastModifiedTime.seconds) * 1000).toLocaleString() : "Unknown";
            
            console.log(`- ID: ${id}`);
            console.log(`  Root: ${rootId}`);
            console.log(`  Updated: ${lastUpdated}`);
        }
        
        if (summaries.length > 5) {
             console.log(`... and ${summaries.length - 5} more.`);
        }
        console.log("--------------------------------------------------");

        console.log("🏁 Test completed cleanly.");
        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Fetch failed:", (e as Error).message);
    }
}

main();
