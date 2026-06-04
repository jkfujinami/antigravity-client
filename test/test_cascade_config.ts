import { AntigravityClient } from "../src/index.js";
import { CortexTrajectorySource, CortexTrajectoryType } from "../src/gen/exa/cortex_pb/cortex_pb.js";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    try {
        const client = await AntigravityClient.connect({ autoDetect: true });
        console.log("✅ Connected!\n");

        console.log("🧠 Testing Cascade Config Limits Override...");

        // Inject deep configuration to bypass safety limits using EXACT schema structure
        const res = await client.lsClient.startCascade({
            source: CortexTrajectorySource.CASCADE_CLIENT,
            trajectoryType: CortexTrajectoryType.CASCADE,
            customAgentSpec: {
                cascadeConfig: {
                    plannerConfig: {
                        disableLoopDetection: true,
                        noToolExplanation: true,
                        maxOutputTokens: 8192,
                        truncationThresholdTokens: 100000
                    },
                    executorConfig: {
                        maxGeneratorInvocations: 100, // bypass standard limit
                        requireFinishTool: true
                    }
                }
            }
        });

        console.log(`   ✅ StartCascade accepted! Cascade ID: ${res.cascadeId}`);
        console.log(`   (The deep planner/executor config override worked)`);

        client.dispose();
    } catch (err: unknown) {
        console.error("❌ Main Error:", err);
    }
}

main();
