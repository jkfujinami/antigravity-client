import { AntigravityClient } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    try {
        const client = await AntigravityClient.connect({ autoDetect: true });
        console.log("✅ Connected!\n");

        console.log("⚔️  Testing Battle Mode (Fork & Merge)...");

        // Start a cascade first to have an ID to fork
        const cascade = await client.lsClient.startCascade({
            source: 1, // CASCADE_CLIENT
            trajectoryType: 4 // CASCADE
        });
        const cascadeId = cascade.cascadeId;
        console.log(`   Initial Cascade ID: ${cascadeId}`);

        // Try to start battle mode (forking the tree)
        try {
            const startBattleReq = await client.lsClient.startBattleMode({
                request: {
                    cascadeId: cascadeId,
                    items: [
                        { chunk: { case: "text", value: "Split here into 2 forks to find the best approach" } }
                    ]
                },
                numForks: 2
            });
            console.log(`   ✅ StartBattleMode accepted! Response:`, startBattleReq);

            const splitIds = (startBattleReq as any).childrenConversationIds || [];
            console.log(`   ✅ Battle forks created: [${splitIds.join(", ")}]`);
            
            // Assuming some work happened on multiple splits, now we merge back
            // Note: EndBattleMode requires complex state, we just verify it exists and is callable
            try {
                await client.lsClient.endBattleMode({
                    sourceConversationId: cascadeId,
                    winnerConversationId: splitIds[0] || cascadeId,
                    mergeStrategy: 1, // 1: MERGE_STRATEGY_SAFE_MERGE
                    endType: 1        // 1: BATTLE_END_TYPE_WINNER_SELECTED
                });
                console.log(`   ✅ EndBattleMode accepted!`);
            } catch (e: any) {
                console.log(`   (EndBattleMode failed to merge, likely due to empty state in forks: ${e.message})`);
            }
        } catch (e: any) {
            console.log(`   ❌ Battle Mode failed: ${e.message}`);
        }

        client.dispose();
    } catch (err: unknown) {
        console.error("❌ Main Error:", err);
    }
}

main();
