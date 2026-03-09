import { AntigravityClient } from "../src/client.js";
import { Model } from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";

async function main() {
  try {
    console.log("🔌 Connecting to Antigravity Language Server...");
    const client = await AntigravityClient.connect(); // Auto-detect mode

    console.log("✅ Connected!");

    const prompt = "Explain what a Language Server does in one sentence.";
    console.log(`📡 Sending prompt: "${prompt}"...`);

    // Call getModelResponse with Gemini 3.1 Pro (Mapped to PLACEHOLDER_M37 in proto)
    const response = await client.getModelResponse(prompt, Model.PLACEHOLDER_M37);

    console.log("\n🤖 AI Response:");
    console.log("--------------------------------------------------");
    console.log(response);
    console.log("--------------------------------------------------");

  } catch (e) {
    console.error("❌ Error:", e);
  }
}

main();
