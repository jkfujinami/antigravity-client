
import { createPromiseClient, PromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { LanguageServerService } from "../gen/exa/language_server_pb_connect.js";
import { HandleCascadeUserInteractionRequest } from "../gen/exa/language_server_pb_pb.js";
import { Cascade } from "../cascade.js";
import { TerminalSession } from "./terminal.js";
import { FileSystem } from "./files.js";
import {
    CortexStepStatus,
    CascadeUserInteraction,
    FilePermissionInteraction,
    FilePermissionInteractionSpec,
    PermissionScope
} from "../gen/exa/cortex_pb_pb.js";
import { Step } from "../gen/gemini_coder_pb.js";

export class Agent {
    private client: PromiseClient<typeof LanguageServerService>;
    private cascade: Cascade | any;
    private terminal: TerminalSession;
    private fs: FileSystem;
    private lastProcessedIndex = -1;

    constructor(serverUrl: string, private cascadeId: string, private trajectoryId: string, client?: any, cascade?: any) {
        if (client) {
            this.client = client;
        } else {
            const transport = createConnectTransport({
                baseUrl: serverUrl,
                httpVersion: "2",
            });
            this.client = createPromiseClient(LanguageServerService, transport);
        }

        if (cascade) {
            this.cascade = cascade;
        } else {
            this.cascade = new Cascade(this.client, cascadeId, trajectoryId);
        }

        this.terminal = new TerminalSession(this.client);
        this.fs = new FileSystem();
    }

    async start() {
        this.cascade.on("update", (state: any) => this.processUpdate(state));
        this.cascade.on("error", (err: any) => console.error("Cascade error:", err));
        this.cascade.on("done", () => {
            console.log("Cascade completed.");
            process.exit(0);
        });

        console.log("Starting Agent loop...");
        await this.cascade.listen();
    }

    private async processUpdate(state: any) {
        if (!state.trajectory || !state.trajectory.steps) return;

        const steps = state.trajectory.steps as Step[];

        // Process new steps
        for (let i = this.lastProcessedIndex + 1; i < steps.length; i++) {
            const step = steps[i];

            console.log(`Step ${i}: ${step.step.case}, Status: ${step.status}`);

            if (step.status === CortexStepStatus.PENDING || step.status === CortexStepStatus.RUNNING) {
                await this.executeStep(step, i);
                this.lastProcessedIndex = i;
            }
        }
    }

    private async executeStep(step: Step, index: number) {
        try {
            switch (step.step.case) {
                case "runCommand":
                    const cmd = step.step.value;
                    if (cmd.commandLine) {
                        console.log(`Executing command: ${cmd.commandLine}`);
                        await this.terminal.execute(cmd.commandLine, "");
                    }
                    break;

                case "writeToFile":
                    const write = step.step.value;
                    // Correct field name: targetFileUri
                    const writeUri = write.targetFileUri;
                    console.log(`Writing to file: ${writeUri}`);

                    const writePath = writeUri.replace('file://', '');

                    // CortexStepWriteToFile does not have embedded filePermissionRequest.
                    // Assuming we proceed or server handled it.
                    // Or we check Step.permissions if available (requires Step type analysis).

                    // Actual write implementation would involve:
                    // await this.fs.writeFile(writePath, write.codeContent.join('\n'));
                    break;

                case "viewFile":
                    const view = step.step.value;
                    // Correct field name: absolutePathUri
                    console.log(`Viewing file: ${view.absolutePathUri}`);
                    break;

                case "listDirectory":
                    const list = step.step.value;
                    // Correct field name: directoryPathUri
                    console.log(`Listing directory: ${list.directoryPathUri}`);
                    break;
            }
        } catch (err) {
            console.error(`Failed to execute step ${index}:`, err);
        }
    }

    private async handleFilePermission(index: number, spec: FilePermissionInteractionSpec) {
        console.log(`Granting permission for: ${spec.absolutePathUri}`);
        const interaction = new CascadeUserInteraction({
            trajectoryId: this.trajectoryId,
            stepIndex: index,
            interaction: {
                case: "filePermission",
                value: new FilePermissionInteraction({
                    allow: true,
                    scope: PermissionScope.UNSPECIFIED,
                    absolutePathUri: spec.absolutePathUri
                })
            }
        });

        const req = new HandleCascadeUserInteractionRequest({
             cascadeId: this.cascadeId,
             interaction: interaction
        });

        await this.client.handleCascadeUserInteraction(req);
    }
}
