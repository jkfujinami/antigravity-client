/**
 * Test that connects to an existing LS and fetches/displays the user's API quota (usage and limits).
 */
import { AntigravityClient } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("📡 Fetching Quota Information...");
        const status = await client.getUserStatus();
        const planStatus = status.userStatus?.planStatus;
        
        if (planStatus) {
            console.log("--------------------------------------------------");
            console.log(`📊 Quota / Plan Status:`);
            console.log(`   Tier   : ${planStatus.planInfo?.planName || "Unknown"} (${planStatus.planInfo?.teamsTier})`);
            console.log(`   Prompt Credits: ${planStatus.availablePromptCredits} / ${planStatus.planInfo?.monthlyPromptCredits}`);
            console.log(`   Flow Credits  : ${planStatus.availableFlowCredits} / ${planStatus.planInfo?.monthlyFlowCredits}`);
            console.log("--------------------------------------------------");
        } else {
            console.log("ℹ️ No Plan/Quota Information available in UserStatus.");
        }

        console.log("🏁 Test completed cleanly.");
        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Quota fetch failed:", (e as Error).message);
    }
}

main();
