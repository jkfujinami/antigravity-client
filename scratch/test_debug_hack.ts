import { AntigravityClient } from "../src/client.js";
import { GetWorkingDirectoriesRequest } from "../src/gen/exa/language_server_pb/language_server_pb.js";

async function main() {
    try {
        console.log("Connecting to Antigravity LS...");
        const client = await AntigravityClient.connect({ autoDetect: true });

        console.log("\n--- Calling GetWorkingDirectories ---");
        const wdRes = await client.lsClient.getWorkingDirectories(new GetWorkingDirectoriesRequest());
        console.log("Raw response (should be JSON now):");
        console.log(wdRes);

    } catch (e) {
        console.error("Error:", e);
    }
}

main();
