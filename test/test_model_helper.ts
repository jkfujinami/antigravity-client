import { AntigravityClient } from "../src/client.js";

async function main() {
    try {
        console.log("Connecting...");
        const client = await AntigravityClient.connect();

        console.log("Getting available models via helper...");
        const models = await client.getAvailableModels();

        console.log("\nStructured Models JSON:");
        console.log(JSON.stringify(models, null, 2));

        // Quick check: check for Gemini 3 Flash
        if (models["Gemini_3_Flash"]) {
             console.log("\nFound Gemini 3 Flash!");
             console.log(`- Model Name: ${models["Gemini_3_Flash"].model}`);
             console.log(`- Model ID : ${models["Gemini_3_Flash"].modelId}`);
        }

    } catch (e) {
        console.error(e);
    }
}

main();
