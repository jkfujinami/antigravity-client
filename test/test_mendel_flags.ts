import { AntigravityClient } from "../src/index.js";

async function run() {
    console.log("🔌 Connecting to Antigravity LS...");
    const client = await AntigravityClient.connect();
    console.log("✅ Connected!\n");

    console.log("🔍 Fetching Mendel Flags (A/B Tests & Internal Features)...");

    try {
        const response = await client.lsClient.getMendelFlags({});
        const experiments = response.experimentConfig?.experiments;
        if (!experiments || experiments.length === 0) {
            console.log("No Mendel experiments (flags) returned.");
        } else {
            console.log(`\nFound ${experiments.length} Mendel Flags:`);
            console.log("=========================================");

            const sortedExp = experiments.sort((a, b) => (a.keyString || "").localeCompare(b.keyString || ""));

            sortedExp.forEach(exp => {
                let valueStr = "No payload";
                if (exp.payload) {
                    const rawValue = String(exp.payload.value);
                    valueStr = rawValue;
                    valueStr = `[${exp.payload.case}] ${valueStr}`;
                }
                const disabledMarker = exp.disabled ? "(DISABLED) " : "";
                console.log(`- ${disabledMarker}${exp.keyString || exp.key}: ${valueStr}`);
            });
            console.log("=========================================\n");
        }
    } catch (error) {
        console.error("❌ Failed to fetch Mendel Flags:", error);
    }
}

run().catch(console.error);
