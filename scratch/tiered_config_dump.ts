/**
 * Dump FetchAvailableModelsResponse's top-level routing/grouping fields
 * (tiered_model_ids, agent_model_sorts, command_model_ids, etc.) to see what
 * "tiered" actually groups together.
 */
import { AntigravityClient } from "../src/index.js";

async function main() {
    const client = await AntigravityClient.connect();
    const res = await client.languageServer.getAvailableModels({});
    const r = (res as any).response;

    console.log("defaultAgentModelId:", r.defaultAgentModelId);
    console.log("\ntieredModelIds:", JSON.stringify(r.tieredModelIds, null, 2));
    console.log("\ncommandModelIds:", r.commandModelIds);
    console.log("tabModelIds:", r.tabModelIds);
    console.log("imageGenerationModelIds:", r.imageGenerationModelIds);
    console.log("mqueryModelIds:", r.mqueryModelIds);
    console.log("webSearchModelIds:", r.webSearchModelIds);
    console.log("commitMessageModelIds:", r.commitMessageModelIds);
    console.log("audioTranscriptionModelIds:", r.audioTranscriptionModelIds);
    console.log("\nagentModelSorts:", JSON.stringify(r.agentModelSorts, null, 2));
    console.log("\nbattleModeModelSorts:", JSON.stringify(r.battleModeModelSorts, null, 2));
    console.log("\ndeprecatedModelIds:", JSON.stringify(r.deprecatedModelIds, null, 2));

    client.dispose();
}

main().catch((e) => {
    console.error("fatal:", e);
    process.exit(1);
});
