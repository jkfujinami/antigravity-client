
import { AntigravityClient } from "../src/client.js";

async function main() {
  try {
    const client = await AntigravityClient.connect();
    console.log("🔌 Connected.");

    console.log("📂 Fetching all cascades...");
    const cascades = await (client as any).lsClient.getAllCascadeTrajectories({});

    console.log("✨ Active Cascades:");
    for (const [id, summary] of Object.entries(cascades.trajectorySummaries)) {
        const sum = summary as any;
        console.log(`- ID: ${id}`);
        console.log(`  Summary: ${sum.summary || "(No summary)"}`);
        console.log(`  Steps: ${sum.stepCount}`);
        console.log(`  Modified: ${sum.lastModifiedTime ? new Date(Number(sum.lastModifiedTime.seconds) * 1000).toLocaleString() : "Unknown"}`);
        console.log("");
    }

  } catch (e) {
    console.error("❌ Error:", e);
  }
}

main();
