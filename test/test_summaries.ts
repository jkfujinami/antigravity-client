
import { AntigravityClient } from "../src/client.js";
import { CascadeTrajectorySummaries } from "../src/gen/exa/jetski_cortex_pb_pb.js";
import { applyMessageDiff } from "../src/reactive/apply.js";

// Allow self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    const client = await AntigravityClient.connect({ autoDetect: true });

    console.log("📡 Listening to Cascade Summaries...");

    // Maintain local state of summaries
    const summariesState = new CascadeTrajectorySummaries();

    try {
        const stream = client.getSummariesStream();

        for await (const res of stream) {
            if (res.diff) {
                // Apply the diff to our local state
                applyMessageDiff(summariesState, res.diff, CascadeTrajectorySummaries);

                console.clear();
                console.log(`\n━━━ Summaries Update (v${res.version}) ━━━`);
                const summaryCount = Object.keys(summariesState.summaries).length;
                console.log(`Total Conversations: ${summaryCount}`);

                if (summaryCount === 0) {
                    continue;
                }

                // Show list of conversations
                const summaries = Object.values(summariesState.summaries).sort((a, b) => {
                    // Sort by last modified DESC
                    const tA = Number(a.lastModifiedTime?.seconds || 0);
                    const tB = Number(b.lastModifiedTime?.seconds || 0);
                    return tB - tA;
                });

                for (const summary of summaries.slice(0, 15)) { // Show top 15
                    const statusRaw = summary.status;
                    let statusStr = "UNKNOWN";
                    if (statusRaw === 0) statusStr = "UNSPECIFIED";
                    if (statusRaw === 1) statusStr = "IDLE";
                    if (statusRaw === 2) statusStr = "RUNNING";
                    if (statusRaw === 3) statusStr = "DONE";
                    if (statusRaw === 4) statusStr = "CANCELLED"; // Guess

                    const time = summary.lastModifiedTime ? new Date(Number(summary.lastModifiedTime.seconds) * 1000).toLocaleString() : "N/A";
                    const title = summary.annotations?.title || "(No Title)";

                    // Simple color output
                    const color = statusRaw === 2 ? "\x1b[32m" : (statusRaw === 3 ? "\x1b[36m" : "\x1b[0m");
                    const reset = "\x1b[0m";

                    console.log(`${color}[Status: ${statusRaw} (${statusStr})] ${summary.trajectoryId} (${time})${reset}`);
                    console.log(`   Title: ${title}`);
                    if (summary.status === 2) {
                        console.log(`   ⚠️  Status is RUNNING`);
                    }
                    console.log("-".repeat(40));
                }
            }
        }

    } catch (error) {
        console.error("❌ Stream Error:", error);
    }
}

main().catch(console.error);
