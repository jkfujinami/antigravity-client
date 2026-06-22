/**
 * Test that connects to an existing LS and fetches/displays the list of available AI models.
 */
import { AntigravityClient } from "../src/index.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("📡 Fetching Available Models...");
        const response = await client.languageServer.getAvailableModels({});
        
        const models = (response as any).models || (response.response as any)?.models || [];
        console.log(`🤖 Found ${models.length} Models:`);
        
        models.forEach((m: any) => {
            const details = m.value;
            const modelEnumName = details ? (Model[details.model] || `Unknown(${details.model})`) : "Unknown";
            console.log(` - Key: ${m.key}, DisplayName: ${details?.displayName}, Enum: ${modelEnumName}, Provider: ${details?.modelProvider}`);
        });
        console.log("--------------------------------------------------");

        console.log("📡 Fetching User Model Configurations...");
        const userStatus = await client.getUserStatus();
        const configs = userStatus.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
        
        if (configs.length > 0) {
            console.log(`✨ Found ${configs.length} Model Configs:`);
            configs.forEach(c => {
                const modelName = (c.modelOrAlias as any)?.model || "Unknown";
                console.log(` - Model: ${modelName}, Label: ${c.label}, Recommended: ${c.isRecommended}`);
            });
        }
        console.log("--------------------------------------------------");

        console.log("🏁 Test completed cleanly.");
        client.dispose();
    } catch (e: unknown) {
        console.error("❌ Models fetch failed:", (e as Error).message);
    }
}

main();
