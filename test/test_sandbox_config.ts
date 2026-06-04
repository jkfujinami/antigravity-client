import { AntigravityClient } from "../src/index.js";
import path from "path";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    try {
        const client = await AntigravityClient.connect({ autoDetect: true });
        console.log("✅ Connected!\n");

        console.log("🛡️  Testing Sandbox Environment (CustomAgentSpec)...");
        const restrictedPath = "file://" + path.resolve("./examples");

        const cascade = await client.lsClient.startCascade({
            source: 1, // CASCADE_CLIENT
            trajectoryType: 4, // CASCADE
            customAgentSpec: {
                workspace: {
                    case: "workspacePaths",
                    value: { absolutePaths: [restrictedPath] }
                },
                commandExecutionPolicy: "NEVER_EXECUTE", // Fake or real policy to restrict
                cascadeConfig: {
                    executorConfig: {
                        researchOnly: true, // Prevent destructive tools
                        enableTasks: false
                    }
                }
            }
        });

        console.log(`   ✅ StartCascade accepted sandbox config! Cascade ID: ${cascade.cascadeId}`);
        console.log(`   (Agent is now constrained to ${restrictedPath} and research-only mode)`);

        client.dispose();
    } catch (err: unknown) {
        console.error("❌ Main Error:", err);
    }
}

main();
