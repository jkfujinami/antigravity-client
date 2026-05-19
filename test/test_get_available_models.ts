import { AntigravityClient } from "../src/client.js";
import { GetAvailableModelsRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";
import {
    Model,
    ModelType,
    APIProvider,
    PromptTemplaterType,
    ToolFormatterType,
    ModelProvider,
} from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";


async function main() {
    try {
        console.log("🔌 Connecting to local Antigravity Language Server...");
        const client = await AntigravityClient.connect();
        
        console.log("📡 Sending GetAvailableModelsRequest to LS Connect-RPC...");
        const req = new GetAvailableModelsRequest({});
        const res = await client.lsClient.getAvailableModels(req);

        console.log("✅ Received GetAvailableModelsResponse from LS!");

        if (!res.response) {
            console.error("❌ Response does not contain 'response' field!");
            process.exit(1);
        }

        const data = res.response;
        const models = data.models || [];

        console.log(`\n============================================================`);
        console.log(`🎉 SUCCESS! Retrieved Model Detailed Specs! Total Models: ${models.length}`);
        console.log(`============================================================\n`);

        for (const entry of models) {
            const key = entry.key;
            const details = entry.value;

            if (!details) continue;

            console.log(`🤖 \x1b[1;32mModel ID: ${key}\x1b[0m`);
            console.log(`   ├─ Basic Metadata:`);
            console.log(`   │  ├─ Display Name                  : ${details.displayName || "-"}`);
            console.log(`   │  ├─ Description                   : ${details.description || "-"}`);
            console.log(`   │  ├─ API Provider                  : ${APIProvider[details.apiProvider] || details.apiProvider} (${details.apiProvider})`);
            console.log(`   │  ├─ Model Provider                : ${ModelProvider[details.modelProvider] || details.modelProvider} (${details.modelProvider})`);
            console.log(`   │  ├─ Model Enum                    : ${Model[details.model] || details.model} (${details.model})`);
            console.log(`   │  ├─ Tag Title                     : ${details.tagTitle || "-"}`);
            console.log(`   │  └─ Tag Description               : ${details.tagDescription || "-"}`);
            
            console.log(`   ├─ Context & Token Limits:`);
            console.log(`   │  ├─ Max Input Tokens (Context)    : \x1b[33m${details.maxTokens.toLocaleString()}\x1b[0m`);
            console.log(`   │  ├─ Max Output Tokens             : \x1b[33m${details.maxOutputTokens.toLocaleString()}\x1b[0m`);
            console.log(`   │  └─ Tokenizer Type                : ${details.tokenizerType || "-"}`);

            console.log(`   ├─ Capability Flags:`);
            console.log(`   │  ├─ Supports Images (Multimodal)  : ${details.supportsImages ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Supports Video                : ${details.supportsVideo ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Supports PDF                  : ${details.supportsPdf ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Supports Cumulative Context   : ${details.supportsCumulativeContext ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Tab Jump Print Line Range     : ${details.tabJumpPrintLineRange ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Estimate Token Counter        : ${details.supportsEstimateTokenCounter ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Add Cursor to Find Target     : ${details.addCursorToFindReplaceTarget ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Requires Lead-in Gen          : ${details.requiresLeadInGeneration ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Requires No XML Tool Examples : ${details.requiresNoXmlToolExamples ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  └─ Requires Image Out Outside Fn : ${details.requiresImageOutputOutsideFunctionResponses ? "✅ Yes" : "❌ No"}`);

            console.log(`   ├─ Thinking & Reasoning Engine:`);
            console.log(`   │  ├─ Supports Thinking             : ${details.supportsThinking ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  ├─ Thinking Budget               : ${details.thinkingBudget}`);
            console.log(`   │  ├─ Min Thinking Budget           : ${details.minThinkingBudget}`);
            console.log(`   │  ├─ Supports Raw Thinking         : ${details.supportsRawThinking ? "✅ Yes" : "❌ No"}`);
            console.log(`   │  └─ Thinking Level                : ${details.thinkingLevel}`);

            console.log(`   ├─ Prompting & Code Generation:`);
            console.log(`   │  ├─ Prompt Templater Type         : \x1b[36m${PromptTemplaterType[details.promptTemplaterType] || details.promptTemplaterType}\x1b[0m`);
            console.log(`   │  ├─ Tool Formatter Type           : \x1b[36m${ToolFormatterType[details.toolFormatterType] || details.toolFormatterType}\x1b[0m`);
            console.log(`   │  └─ Tool Response Key             : ${details.toolResponseKey || "-"}`);

            console.log(`   ├─ Release Status & Visibility:`);
            console.log(`   │  ├─ Recommended                   : ${details.recommended ? "🌟 Yes" : "No"}`);
            console.log(`   │  ├─ Beta                          : ${details.beta ? "🚧 Beta" : "🚀 Release"}`);
            console.log(`   │  ├─ Preview                       : ${details.preview ? "🔬 Preview" : "No"}`);
            console.log(`   │  ├─ Disabled                      : ${details.disabled ? "❌ Disabled" : "✅ Enabled"}`);
            console.log(`   │  ├─ Is Internal Model             : ${details.isInternal ? "🔒 Yes" : "No"}`);
            console.log(`   │  └─ Beta Warning Message          : ${details.betaWarningMessage || "-"}`);

            console.log(`   ├─ Quota & Usage Limits:`);
            if (details.quotaInfo) {
                console.log(`   │  ├─ Remaining Fraction            : ${details.quotaInfo.remainingFraction}`);
                console.log(`   │  └─ Reset Time                    : ${details.quotaInfo.resetTime ? new Date(Number(details.quotaInfo.resetTime.seconds) * 1000).toLocaleString() : "-"}`);
            } else {
                console.log(`   │  └─ Quota Info                    : -`);
            }

            console.log(`   ├─ Supported Mime Types:`);
            if (details.supportedMimeTypes && details.supportedMimeTypes.length > 0) {
                for (const mime of details.supportedMimeTypes) {
                    console.log(`   │  ├─ ${mime.key} : ${mime.value ? "✅" : "❌"}`);
                }
            } else {
                console.log(`   │  └─ None`);
            }

            console.log(`   └─ Model Experiments:`);
            if (details.modelExperiments && details.modelExperiments.experiments && details.modelExperiments.experiments.length > 0) {
                for (const exp of details.modelExperiments.experiments) {
                    let valStr = "";
                    if (exp.value) {
                        const v = exp.value.value;
                        valStr = v?.value !== undefined ? String(v.value) : "undefined";
                    }
                    console.log(`      ├─ ${exp.key} : ${valStr}`);
                }
            } else {
                console.log(`      └─ None`);
            }

            console.log("=".repeat(60));
        }

        console.log(`\n📊 ============================================================`);
        console.log(`📈 GLOBAL ORCHESTRATION SPECS`);
        console.log(`============================================================`);
        console.log(`💡 Default Agent Model ID            : \x1b[1;36m${data.defaultAgentModelId}\x1b[0m`);
        console.log(`💡 Command Model IDs                 : ${JSON.stringify(data.commandModelIds)}`);
        console.log(`💡 Tab Completion Model IDs         : ${JSON.stringify(data.tabModelIds)}`);
        console.log(`💡 Image Generation Model IDs        : ${JSON.stringify(data.imageGenerationModelIds)}`);
        console.log(`💡 MQuery Model IDs                  : ${JSON.stringify(data.mqueryModelIds)}`);
        console.log(`💡 Web Search Model IDs              : ${JSON.stringify(data.webSearchModelIds)}`);
        console.log(`💡 Commit Message Model IDs          : ${JSON.stringify(data.commitMessageModelIds)}`);
        console.log(`💡 Audio Transcription Model IDs     : ${JSON.stringify(data.audioTranscriptionModelIds)}`);
        
        console.log(`\n💡 Agent Model Sorts:`);
        if (data.agentModelSorts) {
            for (const sort of data.agentModelSorts) {
                console.log(`   ├─ Display: ${sort.displayName}`);
                for (const grp of sort.groups) {
                    console.log(`   │  ├─ Group [${grp.displayName}]: ${grp.modelIds.join(", ")}`);
                }
            }
        }

        console.log(`\n💡 Battle Mode Model Sorts:`);
        if (data.battleModeModelSorts) {
            for (const sort of data.battleModeModelSorts) {
                console.log(`   ├─ Display: ${sort.displayName}`);
                for (const grp of sort.groups) {
                    console.log(`   │  ├─ Group [${grp.displayName}]: ${grp.modelIds.join(", ")}`);
                }
            }
        }

        console.log(`\n💡 Deprecated Model Rerouting:`);
        if (data.deprecatedModelIds && data.deprecatedModelIds.length > 0) {
            for (const entry of data.deprecatedModelIds) {
                const info = entry.value;
                if (info) {
                    console.log(`   ├─ Deprecated Model [${entry.key}] -> New Model [${info.newModelId}] (Enum: ${Model[info.newModelEnum]})`);
                }
            }
        } else {
            console.log(`   └─ None`);
        }
        console.log(`============================================================\n`);

    } catch (e) {
        console.error("❌ Failed to retrieve available models specs via LS:", e);
    }
}

main();
