
import { createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { LanguageServerService } from "../src/gen/exa/language_server_pb/language_server_connect.js";
import {
    Metadata,
    TextOrScopeItem,
    ModelOrAlias,
    Model,
    ConversationalPlannerMode,
} from "../src/gen/exa/codeium_common_pb/codeium_common_pb.js";
import {
    StartCascadeRequest,
    SendUserCascadeMessageRequest,
    GetCascadeTrajectoryRequest,
    GetCascadeTrajectoryStepsRequest,
} from "../src/gen/exa/language_server_pb/language_server_pb.js";
import {
    CascadeConfig,
    CascadePlannerConfig,
    CascadeConversationalPlannerConfig,
    CascadeRunStatus,
} from "../src/gen/exa/cortex_pb/cortex_pb.js";
import { AutoDetector } from "../src/autodetect.js";
import { readAuthStatus } from "../src/server/auth-reader.js";
import { Timestamp } from "@bufbuild/protobuf";

async function main() {
    const detector = new AutoDetector();
    const server = await detector.findBestServer();
    const port = server.httpsPort || server.httpPort;
    const csrfToken = server.csrfToken;
    const apiKey = process.env.ANTIGRAVITY_API_KEY || readAuthStatus().apiKey || "";

    console.log(`Connecting to LS at port ${port}...`);

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
        sessionId: `session-${Math.random().toString(36).slice(2)}`,
        lsTimestamp: Timestamp.fromDate(new Date()),
        disableTelemetry: true,
    });

    // === Step 1: Start Cascade ===
    console.log("\n[Step 1] Starting Cascade...");
    const startRes = await lsClient.startCascade(new StartCascadeRequest({ metadata }));
    const cascadeId = startRes.cascadeId;
    console.log(`Cascade ID: ${cascadeId}`);

    // === Step 2: Send Message ===
    console.log("\n[Step 2] Sending message...");
    const sendReq = new SendUserCascadeMessageRequest({
        cascadeId,
        metadata,
        items: [
            new TextOrScopeItem({ chunk: { case: "text", value: "What is 2+2? Reply with just the number." } })
        ],
        cascadeConfig: new CascadeConfig({
            plannerConfig: new CascadePlannerConfig({
                plannerTypeConfig: {
                    case: "conversational",
                    value: new CascadeConversationalPlannerConfig({
                        plannerMode: ConversationalPlannerMode.DEFAULT,
                    })
                },
                requestedModel: new ModelOrAlias({
                    choice: { case: "model", value: Model.PLACEHOLDER_M84 }
                })
            })
        }),
        blocking: false,
        clientType: 1,
    });
    await lsClient.sendUserCascadeMessage(sendReq);
    console.log("Message sent (non-blocking).");

    // === Step 3: Poll GetCascadeTrajectory ===
    console.log("\n[Step 3] Polling GetCascadeTrajectory...");
    let lastStepCount = 0;
    let lastTextLength = 0;
    const maxPolls = 60;
    const pollInterval = 500;

    for (let i = 0; i < maxPolls; i++) {
        await new Promise(r => setTimeout(r, pollInterval));

        try {
            const trajRes = await lsClient.getCascadeTrajectory(
                new GetCascadeTrajectoryRequest({ cascadeId })
            );

            const status = trajRes.status;
            const statusName = CascadeRunStatus[status] || String(status);
            const numSteps = trajRes.numTotalSteps;
            const steps = trajRes.trajectory?.steps || [];

            // Extract text from plannerResponse steps
            let latestText = "";
            for (const step of steps) {
                if (step.step?.case === "plannerResponse") {
                    const planner = step.step.value as any;
                    latestText = planner.modifiedResponse || planner.response || "";
                }
            }

            const textChanged = latestText.length !== lastTextLength;
            const stepsChanged = numSteps !== lastStepCount;

            if (textChanged || stepsChanged || i === 0) {
                console.log(`  [poll ${i}] status=${statusName} steps=${numSteps} textLen=${latestText.length}`);
                if (textChanged && latestText.length > 0) {
                    // Show last 200 chars of text
                    const tail = latestText.length > 200
                        ? "..." + latestText.slice(-200)
                        : latestText;
                    console.log(`  text: ${tail}`);
                }
            }

            lastStepCount = numSteps;
            lastTextLength = latestText.length;

            // Done?
            if (status === CascadeRunStatus.IDLE && numSteps > 0 && i > 2) {
                console.log(`\n[Done] Cascade completed. Final status: ${statusName}`);
                console.log(`Total steps: ${numSteps}`);
                if (latestText) {
                    console.log(`Final response:\n${latestText}`);
                }
                break;
            }
        } catch (e: any) {
            console.error(`  [poll ${i}] ERROR: ${e.message}`);
        }
    }

    // === Step 4: Also try GetCascadeTrajectorySteps (for comparison) ===
    console.log("\n[Step 4] Testing GetCascadeTrajectorySteps...");
    try {
        const stepsRes = await lsClient.getCascadeTrajectorySteps(
            new GetCascadeTrajectoryStepsRequest({ cascadeId, stepOffset: 0 })
        );
        console.log(`Steps response: numTotalSteps=${(stepsRes as any).numTotalSteps}`);
        const steps = (stepsRes as any).steps || [];
        console.log(`Returned ${steps.length} steps.`);
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            console.log(`  step[${i}]: case=${step.step?.case || "?"} status=${step.status}`);
        }
    } catch (e: any) {
        console.error(`GetCascadeTrajectorySteps FAILED: ${e.message}`);
    }
}

main().catch(console.error);
