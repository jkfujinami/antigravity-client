
import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { LanguageServerService } from "../src/gen/exa/language_server_pb/language_server_connect.js";
import {
    Metadata,
    TextOrScopeItem,
} from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import {
    StartCascadeRequest,
    SendUserCascadeMessageRequest,
} from "../src/gen/exa/language_server_pb/language_server_pb.js";
import {
    StreamAgentStateUpdatesRequest,
} from "../src/gen/exa/jetski_cortex_pb/jetski_cortex_pb.js";
import { CortexTrajectorySource } from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { AutoDetector } from "../src/autodetect.js";
import { readAuthStatus } from "../src/server/auth-reader.js";
import { Timestamp } from "@bufbuild/protobuf";
import * as crypto from "crypto";

// UI Helpers (ANSI Colors)
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    blue: "\x1b[34m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
};

function log(msg: string) {
    console.log(`${colors.dim}[${new Date().toLocaleTimeString()}]${colors.reset} ${msg}`);
}

async function main() {
    console.clear();
    console.log(`${colors.bgBlue}${colors.bright}  ANTIGRAVITY CASCADE ENGINE - FULL 100% LISTENER  ${colors.reset}\n`);

    const detector = new AutoDetector();
    const server = await detector.findBestServer();
    const port = server.httpsPort || server.httpPort;
    const csrfToken = server.csrfToken;
    const apiKey = process.env.ANTIGRAVITY_API_KEY || readAuthStatus().apiKey || "";

    const transport = createConnectTransport({
        baseUrl: `https://127.0.0.1:${port}`,
        httpVersion: "2",
        nodeOptions: { rejectUnauthorized: false },
        interceptors: [
            (next) => async (req) => {
                req.header.set("x-codeium-csrf-token", csrfToken);
                return await next(req);
            },
        ],
    });

    const lsClient = createPromiseClient(LanguageServerService, transport);

    const metadata = new Metadata({
        apiKey: apiKey,
        ideName: "vscode",
        ideVersion: "1.91.0",
        extensionName: "codeium",
        extensionVersion: "1.10.0",
        os: "macos",
        locale: "ja-JP",
        sessionId: `session-${crypto.randomUUID()}`,
        lsTimestamp: Timestamp.fromDate(new Date()),
        disableTelemetry: true,
    });

    log(`${colors.blue}Initiating Cascade Session...${colors.reset}`);
    const startRes = await lsClient.startCascade(new StartCascadeRequest({
        metadata,
        source: CortexTrajectorySource.CASCADE_CLIENT,
    }));
    const cascadeId = startRes.cascadeId;
    log(`${colors.green}Cascade ID:${colors.reset} ${colors.bright}${cascadeId}${colors.reset}`);

    log(`${colors.magenta}Initializing 100% AgentStateUpdate Stream...${colors.reset}`);

    // Track seen step indices and their last content lengths to only print diffs
    const seenIndices = new Set<number>();
    const lastContentLength = new Map<number, number>();
    let currentStatus = 0;

    const listener = (async () => {
        try {
            const stream = lsClient.streamAgentStateUpdates(new StreamAgentStateUpdatesRequest({
                conversationId: cascadeId,
                subscriberId: cascadeId,
                trajectoryVerbosity: 3, // FULL VERBOSITY
            }));

            for await (const res of stream) {
                const update = res.update;
                if (!update) continue;

                // Handle Status Changes
                if (update.status !== currentStatus) {
                    const statusStr = ["UNSPECIFIED", "IDLE", "RUNNING", "ERROR"][update.status] || update.status.toString();
                    process.stdout.write(`\n${colors.dim}[STATUS] ${statusStr}${colors.reset}\n`);
                    currentStatus = update.status;
                }

                // Monitor Executor Metadata
                if (update.executorMetadata) {
                    const meta = update.executorMetadata;
                    if (meta.numGeneratorInvocations > 0 && !seenIndices.has(-1)) {
                        log(`${colors.cyan}Generator Invocations: ${meta.numGeneratorInvocations}${colors.reset}`);
                        seenIndices.add(-1); // Flag for meta logging
                    }
                }

                // Process Trajectory Updates
                const mainTraj = update.mainTrajectoryUpdate;
                if (mainTraj?.stepsUpdate) {
                    const { steps, indices } = mainTraj.stepsUpdate;

                    for (let i = 0; i < steps.length; i++) {
                        const stepIdx = indices[i];
                        const step = steps[i];
                        const type = step.step?.case;
                        const value = step.step?.value as any;

                        if (!type) continue;

                        // Identify New Step Types
                        if (!seenIndices.has(stepIdx)) {
                            process.stdout.write(`\n${colors.bgMagenta}${colors.white} STEP ${stepIdx}: ${type} ${colors.reset}\n`);
                            seenIndices.add(stepIdx);
                        }

                        // Detailed Handling per Type
                        switch (type) {
                            case "userInput":
                                if (lastContentLength.get(stepIdx) === undefined) {
                                    process.stdout.write(`${colors.dim}Query: ${value.userResponse}${colors.reset}\n`);
                                    lastContentLength.set(stepIdx, value.userResponse.length);
                                }
                                break;

                            case "plannerResponse":
                                const text = value.modifiedResponse || value.response || "";
                                const lastLen = lastContentLength.get(stepIdx) || 0;
                                if (text.length > lastLen) {
                                    process.stdout.write(text.slice(lastLen));
                                    lastContentLength.set(stepIdx, text.length);
                                }
                                break;

                            default:
                                // Tool calls (e.g. runCommand, grepSearch) and other steps
                                if (lastContentLength.get(stepIdx) === undefined) {
                                    process.stdout.write(`${colors.yellow}🔨 Step: ${colors.bright}${type}${colors.reset}\n`);
                                    if (value) {
                                        process.stdout.write(`${colors.dim}Data: ${JSON.stringify(value)}${colors.reset}\n`);
                                    }
                                    lastContentLength.set(stepIdx, 1);
                                }
                                break;

                            case "checkpoint":
                                if (lastContentLength.get(stepIdx) === undefined) {
                                    process.stdout.write(`${colors.green}📌 Checkpoint Reached: ${value.checkpointId}${colors.reset}\n`);
                                    lastContentLength.set(stepIdx, 1);
                                }
                                break;
                        }
                    }
                }

                // turn end condition
                if (update.status === 1 /* IDLE */ && seenIndices.size > 1) {
                    process.stdout.write(`\n${colors.green}✔ Turn Finished Successfully.${colors.reset}\n`);
                    break;
                }
            }
        } catch (e: any) {
            console.error(`\n${colors.red}❗ STREAM FATAL ERROR: ${e.message}${colors.reset}`);
        }
    })();

    // Warm up the stream
    await new Promise(r => setTimeout(r, 1000));

    const prompt = "Explain the 'Antigravity' project mission. What makes it different from standard AI assistants?";
    log(`${colors.bright}Sending Payload:${colors.reset} ${colors.dim}${prompt}${colors.reset}`);

    const sendReq = new SendUserCascadeMessageRequest({
        cascadeId,
        metadata,
        items: [
            new TextOrScopeItem({ chunk: { case: "text", value: prompt } })
        ],
        cascadeConfig: {
            plannerConfig: {
                plannerTypeConfig: {
                    case: "conversational",
                    value: { plannerMode: 1 }
                },
                requestedModel: {
                    choice: { case: "model", value: 1187 } // Gemini 3 Flash
                }
            }
        } as any,
        blocking: false,
        clientType: 1,
    });

    await lsClient.sendUserCascadeMessage(sendReq);
    await listener;

    console.log(`\n${colors.dim}--- [100% Listener Diagnostic End] ---${colors.reset}\n`);
}

main().catch((err) => {
    console.error(`\n${colors.red}FATAL TERMINATION: ${err.message}${colors.reset}`);
});
