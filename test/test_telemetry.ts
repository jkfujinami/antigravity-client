import { AntigravityClient } from "../src/index.js";
import path from "path";

async function main() {
    console.log("🔌 Connecting to Antigravity LS...");
    try {
        const client = await AntigravityClient.connect({ autoDetect: true });
        console.log("✅ Connected!\n");

        console.log("🧪 1. Dumping Mendel Experiments (A/B Tests)...");
        try {
            const mendelReq = await client.lsClient.getMendelFlags({});
            const exps = mendelReq.experimentConfig?.experiments || [];
            console.log(`   ✅ Success! Experiments enabled length: ${exps.length}`);
            const firstFew = exps.slice(0, 3).map(e => e.key).join(", ");
            console.log(`   Some active experiments: [${firstFew}]`);
        } catch (e: any) {
            console.log(`   ❌ GetMendelFlags failed: ${e.message}`);
        }
        console.log();

        console.log("✈️  2. Requesting Flight Recorder Dump...");
        try {
            const tracePath = path.resolve("./flight_recorder.trace");
            await client.lsClient.dumpFlightRecorder({ traceFilePath: tracePath });
            console.log(`   Flight recorder dump requested at: ${tracePath}`);
        } catch (e: any) {
            // It might fail if not initialized in non-Google builds, but the API exists
            console.log(`   (DumpFlightRecorder API reached, but failed: ${e.message})`);
        }
        console.log();

        console.log("⚠️  3. SimulateSegFault (Danger Zone)...");
        // DANGER: Running this will literally kill the LS process and potentially crash your IDE.
        // Uncomment at your own risk.
        /*
        try {
            await client.lsClient.simulateSegFault({});
            console.log("   If you see this, the LS didn't crash (which is weird).");
        } catch (e: any) {
            console.log(`   LS Crashed intentionally: ${e.message}`);
        }
        */
        console.log("   [Skipped] Uncomment in code to intentionally crash the LS process.");

        client.dispose();
    } catch (err: unknown) {
        console.error("❌ Main Error:", err);
    }
}

main();
