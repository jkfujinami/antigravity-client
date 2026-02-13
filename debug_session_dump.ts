
import { AntigravityClient } from "./src/client.js";
import { StreamReactiveUpdatesRequest } from "./src/gen/exa/reactive_component_pb_pb.js";
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.join(process.cwd(), '.last_cascade_id');

async function main() {
    console.log("🔌 Connecting to Antigravity LS (Debug Listener)...");

    try {
        const agClient = await AntigravityClient.connect({ autoDetect: true });

        // Use the public lsClient directly
        const client = agClient.lsClient;

        if (!fs.existsSync(SESSION_FILE)) {
            console.error("❌ No session file found (.last_cascade_id). Run the CLI first.");
            process.exit(1);
        }

        const cascadeId = fs.readFileSync(SESSION_FILE, 'utf-8').trim();
        console.log(`🔍 Listening to session: ${cascadeId}`);

        const req = new StreamReactiveUpdatesRequest({
            id: cascadeId,
            protocolVersion: 1,
            subscriberId: "debug-listener-" + Date.now(),
        });

        console.log("--- START STREAM ---");

        for await (const res of client.streamCascadeReactiveUpdates(req)) {
            const timestamp = new Date().toISOString();
            console.log(`\n\x1b[36m[${timestamp}] 📦 Update Received\x1b[0m`);

            if (res.diff) {
                // Pretty print the diff
                const diffStr = JSON.stringify(res.diff, (key, value) => {
                     // Filter noise
                     if (key === 'windowId') return undefined;
                     if (key === 'view' && value?.case === 'file') return '[File View Content]';
                     if (typeof value === 'bigint') return value.toString();
                     if (value && value.type === 'Buffer') return `[Binary: ${value.data.length} bytes]`;
                     return value;
                }, 2);
                console.log(diffStr);
            } else {
                console.log("(Empty Diff)");
            }
        }

    } catch (err) {
        console.error("\n❌ Error:", err);
    }
}

main();
