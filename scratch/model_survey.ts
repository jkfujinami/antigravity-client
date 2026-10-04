/**
 * Survey which Model enum values are exposed via GetAvailableModels/GetModelStatuses/
 * cascadeModelConfigData vs the full ~691-entry Model enum, to see whether
 * GetModelResponse (one-shot) can reach models Cascade doesn't surface.
 */
import { AntigravityClient } from "../src/index.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

async function main() {
    const client = await AntigravityClient.connect();

    const allEnumEntries = Object.entries(Model)
        .filter(([k, v]) => typeof v === "number")
        .map(([k, v]) => ({ name: k, id: v as number }));
    console.log(`Full Model enum: ${allEnumEntries.length} entries`);

    const avail = await client.languageServer.getAvailableModels({});
    const availModels: any[] = (avail as any).models || [];
    console.log(`getAvailableModels: ${availModels.length} entries`);
    const availIds = new Set(availModels.map((m) => m.value?.model));

    const statuses = await client.languageServer.getModelStatuses({});
    const statusInfos: any[] = (statuses as any).modelStatusInfos || [];
    console.log(`getModelStatuses: ${statusInfos.length} entries`);
    statusInfos.slice(0, 3).forEach((s) => console.log("  sample status:", JSON.stringify(s)));
    const statusIds = new Set(statusInfos.map((s) => s.model));

    const userStatus = await client.getUserStatus();
    const configs = userStatus.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
    console.log(`cascadeModelConfigData.clientModelConfigs: ${configs.length} entries`);
    const cascadeIds = new Set(
        configs.map((c) => (c.modelOrAlias as any)?.model).filter((v) => v !== undefined)
    );

    console.log("\n--- getAvailableModels list ---");
    availModels.forEach((m) => {
        const d = m.value;
        console.log(` - ${Model[d?.model] || d?.model} | ${d?.displayName} | provider=${d?.modelProvider}`);
    });

    console.log("\n--- Cascade-selectable (cascadeModelConfigData) ---");
    configs.forEach((c) => {
        const id = (c.modelOrAlias as any)?.model;
        console.log(` - ${Model[id] || JSON.stringify(c.modelOrAlias)} | label=${c.label} | recommended=${c.isRecommended}`);
    });

    console.log("\n--- Enum entries NOT in getAvailableModels (candidates for hidden/legacy models) ---");
    const hidden = allEnumEntries.filter((e) => e.id !== 0 && !availIds.has(e.id) && e.id < 1000);
    console.log(`${hidden.length} candidates (excluding PLACEHOLDER_* >= 1000):`);
    hidden.forEach((e) => console.log(`   ${e.name} = ${e.id}${statusIds.has(e.id) ? "  [has status entry]" : ""}`));

    client.dispose();
}

main().catch((e) => {
    console.error("survey failed:", e);
    process.exit(1);
});
