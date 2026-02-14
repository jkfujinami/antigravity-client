import { AntigravityClient } from "../src/client.js";
import { Model, ModelStatus, ModelAlias } from "../src/gen/exa/codeium_common_pb_pb.js";

/**
 * Antigravity LS から使用可能なモデル一覧を取得し、表示するテストスクリプト
 *
 * getModelStatuses() が空を返す場合があるため、
 * UserStatus に含まれる詳細なモデル設定情報も併せて表示します。
 */
async function testModelStatuses() {
    try {
        console.log("Connecting to Antigravity LS...");
        const client = await AntigravityClient.connect({ autoDetect: true });

        // 1. getModelStatuses() の呼び出し
        console.log("\n--- Method: getModelStatuses() ---");
        const response = await client.getModelStatuses();

        if (response.modelStatusInfos && response.modelStatusInfos.length > 0) {
            response.modelStatusInfos.forEach((info) => {
                const modelName = Model[info.model] || `UNKNOWN(${info.model})`;
                const statusName = ModelStatus[info.status] || `UNKNOWN(${info.status})`;
                console.log(`[${modelName}] Status: ${statusName}, Message: ${info.message || "none"}`);
            });
        } else {
            console.log("No explicit model statuses returned (Empty list).");
        }

        // 2. UserStatus 内のモデル設定を確認
        console.log("\n--- Method: getUserStatus() (Cascade Model Config) ---");
        const userStatus = await client.getUserStatus();
        const config = userStatus.userStatus?.cascadeModelConfigData;

        if (config && config.clientModelConfigs) {
            console.log(`Found ${config.clientModelConfigs.length} configured models:`);

            config.clientModelConfigs.forEach((m: any) => {
                const choice = m.modelOrAlias?.choice;
                let modelIdentifier = "Unknown";

                if (choice) {
                    if (choice.case === "model") {
                        modelIdentifier = Model[choice.value] || `Model(${choice.value})`;
                    } else if (choice.case === "alias") {
                        modelIdentifier = ModelAlias[choice.value] || `Alias(${choice.value})`;
                    }
                }

                const label = m.label || "No Label";
                const premium = m.isPremium ? "[Premium]" : "";
                const recommended = m.isRecommended ? "[Recommended]" : "";
                const disabled = m.disabled ? "[Disabled]" : "";

                console.log(`- ${label.padEnd(30)} | ${modelIdentifier.padEnd(35)} ${premium}${recommended}${disabled}`);
            });

            if (config.defaultOverrideModelConfig) {
                const defChoice = config.defaultOverrideModelConfig.modelOrAlias?.choice;
                let defName = "Unknown";
                if (defChoice?.case === "model") {
                    defName = Model[defChoice.value] || `Model(${defChoice.value})`;
                } else if (defChoice?.case === "alias") {
                    defName = ModelAlias[defChoice.value] || `Alias(${defChoice.value})`;
                }
                console.log(`\nDefault Model: ${defName}`);
            }
        } else {
            console.log("No model configuration found in UserStatus.");
        }

    } catch (error) {
        console.error("Error fetching model statuses:", error);
    }
}

testModelStatuses();
