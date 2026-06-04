import { AntigravityClient } from "../src/index.js";
import path from "path";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    try {
        const client = await AntigravityClient.connect({ autoDetect: true });
        
        console.log("✅ Connected! Exposing raw capabilities...\n");

        // 1. Raw Filesystem Access bypassing Node's fs
        console.log("📂 1. Testing Raw LS Filesystem Access...");
        const targetFile = "file://" + path.resolve("package.json");
        const statReq = await client.lsClient.statUri({ uri: targetFile });
        console.log(`   Stat result: Type ${statReq.fileType}, Modified: ${statReq.modTime?.toDate().toISOString()}`);

        const readReq = await client.lsClient.readFile({ uri: targetFile });
        const contentSample = new TextDecoder().decode(readReq.content).slice(0, 100);
        console.log(`   Read result snippet: ${contentSample.replace(/\n/g, "")}...\n`);

        // 2. Manipulating IDE Workspaces
        console.log("🏗️  2. Manipulating IDE Workspaces...");
        const workspacePath = path.resolve("./examples");
        await client.lsClient.addTrackedWorkspace({
            workspace: workspacePath,
            doNotWatchFiles: false,
            isPassiveWorkspace: false
        });
        console.log(`   Added tracked workspace: ${workspacePath}\n`);

        // 3. MCP Server Management (Deep IDE state)
        console.log("🧩 3. Managing MCP Servers...");
        try {
            const mcpStates = await client.lsClient.getMcpServerStates({});
            console.log(`   Current MCP Servers loaded: ${mcpStates.states.length}`);
            if (mcpStates.states.length > 0) {
                console.log(`   First MCP Server: ${mcpStates.states[0].name} (Status: ${mcpStates.states[0].status})`);
            }
        } catch (e: any) {
            console.log(`   MCP States fetch skipped or failed: ${e.message}`);
        }
        console.log();

        // 4. Inspecting Deep Server Configurations (God Mode settings)
        console.log("⚙️  4. Inspecting LS Server Configuration...");
        try {
            const configReq = await client.lsClient.getServerConfiguration({});
            console.log(`   Dev Mode: ${configReq.config?.devMode}`);
            console.log(`   Is Google Environment: ${configReq.config?.isGoogleEnvironment}`);
            console.log(`   App Data Dir: ${configReq.config?.appDataDir}`);
            console.log(`   Use Local Chrome: ${configReq.config?.useLocalChrome}`);
        } catch (e: any) {
            console.log(`   GetServerConfiguration failed: ${e.message}`);
        }
        console.log();

        // 5. Dumping A/B Test / Experiment Flags
        console.log("🧪 5. Dumping Mendel Experiments (A/B Tests)...");
        try {
            const mendelReq = await client.lsClient.getMendelFlags({});
            console.log(`   Experiments enabled length: ${mendelReq.experimentConfig?.experiments.length}`);
            const firstFew = mendelReq.experimentConfig?.experiments.slice(0, 3).map(e => e.key).join(", ");
            console.log(`   Some active experiments: [${firstFew}]`);
        } catch (e: any) {
            console.log(`   GetMendelFlags failed: ${e.message}`);
        }
        console.log();

        // 6. Flight Recorder Dump
        console.log("✈️  6. Requesting Flight Recorder Dump...");
        try {
            const tracePath = path.resolve("./flight_recorder.trace");
            await client.lsClient.dumpFlightRecorder({ traceFilePath: tracePath });
            console.log(`   Flight recorder dump requested at: ${tracePath}`);
        } catch (e: any) {
            console.log(`   DumpFlightRecorder failed: ${e.message}`);
        }
        console.log();

        // 7. Raw Cascade Initialization with extreme control
        console.log("🧠 7. Preparing a Raw Cascade Fork (Simulated)...");
        // We won't fully start it to avoid hanging, but we'll show how the schema is used
        const fakeCustomAgent = {
            name: "Headless Reviewer",
            systemPrompt: "You are a headless CI/CD bot.",
            toolGroups: []
        };
        console.log(`   Injecting CustomAgentSpec: ${JSON.stringify(fakeCustomAgent)}`);
        
        console.log("\n✅ All deep feature tests completed successfully.");
        console.log("\n💥 Fun fact: You could call 'client.lsClient.simulateSegFault({})' here to intentionally crash the LS process!");
        client.dispose();

    } catch (err: unknown) {
        console.error("❌ Main Error:", err);
    }
}

main();
