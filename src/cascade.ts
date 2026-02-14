
import { EventEmitter } from "events";
import type { PromiseClient } from "@connectrpc/connect";
import { LanguageServerService } from "./gen/exa/language_server_pb_connect.js";
import {
    SendUserCascadeMessageRequest,
    GetCascadeTrajectoryRequest,
    HandleCascadeUserInteractionRequest,
    CancelCascadeInvocationRequest,
} from "./gen/exa/language_server_pb_pb.js";
import {
    CascadeUserInteraction,
    CascadeRunCommandInteraction,
    FilePermissionInteraction,
    CascadeOpenBrowserUrlInteraction,
    RequestedInteraction,
    CortexStepStatus,
    CascadeRunStatus,
    PermissionScope,
} from "./gen/exa/cortex_pb_pb.js";
import { StreamReactiveUpdatesRequest } from "./gen/exa/reactive_component_pb_pb.js";
import {
    Metadata,
    TextOrScopeItem,
    ModelOrAlias,
    Model,
    ConversationalPlannerMode
} from "./gen/exa/codeium_common_pb_pb.js";
import {
    CascadeConfig,
    CascadePlannerConfig,
    CascadeConversationalPlannerConfig
} from "./gen/exa/cortex_pb_pb.js";
import { Trajectory, Step } from "./gen/gemini_coder_pb.js";
import { applyMessageDiff } from "./reactive/apply.js";
import { CascadeState } from "./gen/exa/jetski_cortex_pb_pb.js";

export interface CascadeEvent {
    type: "text" | "thinking" | "status" | "error" | "done" | "update" | "interaction" | "command_output" | "raw_update";
    text?: string;
    delta?: string;
    status?: string;
    error?: any;
    state?: any;
    interaction?: RequestedInteraction;
    stepIndex?: number;
    autoRun?: boolean;
    needsApproval?: boolean;
    commandLine?: string;
    outputType?: "stdout" | "stderr";
    diff?: any; // For raw_update debugging
}

export class Cascade extends EventEmitter {
    public state: CascadeState = new CascadeState();
    private isListening = false;
    private lastEmittedText: Record<number, string> = {};
    private lastEmittedThinking: Record<number, string> = {};
    private lastEmittedStdout: Record<number, string> = {}; // Track stdout
    private lastEmittedStderr: Record<number, string> = {}; // Track stderr
    private emittedInteractions = new Set<number>();
    private lastStatus: CascadeRunStatus = CascadeRunStatus.UNSPECIFIED;

    constructor(
        public readonly cascadeId: string,
        private lsClient: PromiseClient<typeof LanguageServerService>,
        private apiKey: string
    ) {
        super();
    }

    /**
     * Starts listening to reactive updates for this cascade.
     */
    async listen() {
        if (this.isListening) return;
        this.isListening = true;

        const req = new StreamReactiveUpdatesRequest({
            id: this.cascadeId,
            protocolVersion: 1,
            subscriberId: "antigravity-client-" + Date.now(),
        });

        try {
            for await (const res of this.lsClient.streamCascadeReactiveUpdates(req)) {
                if (res.diff) {
                    // Emit raw update for debugging BEFORE applying
                    this.emit("raw_update", {
                        type: "raw_update",
                        diff: res.diff
                    });

                    // We apply the diff to our local state
                    applyMessageDiff(this.state, res.diff, CascadeState);

                    // Trigger events based on diff contents
                    this.emitEvents();
                }
            }
            this.state.status = CascadeRunStatus.IDLE;
            this.emit("update", this.state);
            this.emit("done");
        } catch (err) {
            this.emit("error", err);
        } finally {
            this.isListening = false;
        }
    }

    private emitEvents() {
        this.emit("update", this.state);

        // Check for turn completion (transition to IDLE)
        if (this.state.status === CascadeRunStatus.IDLE && this.lastStatus !== CascadeRunStatus.IDLE) {
            // If we transitioned to IDLE, it usually means the turn is complete.
            this.emit("done");
        }
        this.lastStatus = this.state.status;

        if (!this.state.trajectory?.steps) return;

        this.state.trajectory.steps.forEach((step: Step, index: number) => {
            if (!step) return;

            // --- 1. Interactions ---
            const status = step.status;
            // WAITING state (9) is often transient or not ready for interaction.
            // We wait for PENDING or RUNNING before emitting interaction events.
            const isInteractiveState =
                status === CortexStepStatus.PENDING ||
                status === CortexStepStatus.RUNNING ||
                status === CortexStepStatus.WAITING;

            if (isInteractiveState && step.requestedInteraction && step.requestedInteraction.interaction.case && !this.emittedInteractions.has(index)) {

                let autoRun = false;
                let commandLine = "";

                const runCommand = (step as any).runCommand ||
                                   (step.step?.case === "runCommand" ? step.step.value : null);

                if (runCommand) {
                    autoRun = runCommand.shouldAutoRun;
                    commandLine = runCommand.proposedCommandLine || runCommand.commandLine;
                }

                // If autoRun is true, normally server handles it.
                // However, if status is WAITING, reliable interaction is required.
                let needsApproval = !autoRun;
                if (status === CortexStepStatus.WAITING) {
                    needsApproval = true;
                }

                this.emittedInteractions.add(index);
                this.emit("interaction", {
                    type: "interaction",
                    interaction: step.requestedInteraction,
                    stepIndex: index,
                    autoRun,
                    needsApproval,
                    commandLine
                });
            }

            // --- 2. RunCommand Output (Stdout/Stderr) ---
            const runCommandPlain = (step as any).runCommand ||
                                    (step.step?.case === "runCommand" ? step.step.value : null);

            if (runCommandPlain) {
                const stdout = runCommandPlain.stdout || "";
                const stderr = runCommandPlain.stderr || "";

                // Stdout Delta
                const lastStdout = this.lastEmittedStdout[index] || "";
                if (stdout.length > lastStdout.length) {
                    const delta = stdout.substring(lastStdout.length);
                    this.emit("command_output", {
                        type: "command_output",
                        text: stdout,
                        delta,
                        outputType: "stdout",
                        stepIndex: index
                    });
                    this.lastEmittedStdout[index] = stdout;
                }

                // Stderr Delta
                const lastStderr = this.lastEmittedStderr[index] || "";
                if (stderr.length > lastStderr.length) {
                    const delta = stderr.substring(lastStderr.length);
                    this.emit("command_output", {
                        type: "command_output",
                        text: stderr,
                        delta,
                        outputType: "stderr",
                        stepIndex: index
                    });
                    this.lastEmittedStderr[index] = stderr;
                }
            }

            // --- 3. Text/Thinking ---
            // Fix: properly check for plannerResponse and access fields safely
            if (step.step?.case === "plannerResponse") {
                const planner = step.step.value as any;
                // 'planner' is the plannerResponse message or object
                const response = planner.response || "";
                const thinking = planner.thinking || "";

                // Text Delta
                const lastText = this.lastEmittedText[index] || "";
                if (response.length > lastText.length) {
                    const delta = response.substring(lastText.length);
                    this.emit("text", {
                        text: response,
                        delta,
                        stepIndex: index
                    });
                    this.lastEmittedText[index] = response;
                }

                // Thinking Delta
                const lastThinking = this.lastEmittedThinking[index] || "";
                if (thinking.length > lastThinking.length) {
                    const delta = thinking.substring(lastThinking.length);
                    this.emit("thinking", {
                        text: thinking,
                        delta,
                        stepIndex: index
                    });
                    this.lastEmittedThinking[index] = thinking;
                }
            }
        });
    }

    async sendMessage(text: string, options: { model?: Model } = {}) {
        const metadata = new Metadata({
            apiKey: this.apiKey,
            ideName: "vscode",
            ideVersion: "1.107.0",
            extensionName: "antigravity",
            extensionVersion: "1.107.0",
        });

        const req = new SendUserCascadeMessageRequest({
            cascadeId: this.cascadeId,
            metadata,
            items: [
                new TextOrScopeItem({
                    chunk: { case: "text", value: text }
                })
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
                        choice: {
                            case: "model",
                            value: options.model || Model.PLACEHOLDER_M18
                        }
                    })
                })
            }),
            blocking: true,
            clientType: 1,
        });

        return await this.lsClient.sendUserCascadeMessage(req);
    }

    /**
     * Fetches the full historical trajectory of this cascade.
     */
    async getHistory() {
        const req = new GetCascadeTrajectoryRequest({
            cascadeId: this.cascadeId,
            // withSynopsis: true // Optional if needed
        });
        const response = await this.lsClient.getCascadeTrajectory(req);

        // Update local state with the fetched trajectory
        if (response.trajectory) {
            this.state.trajectory = response.trajectory;
        }

        return response;
    }

    /**
     * Approves a command execution request.
     */
    async approveCommand(stepIndex: number, proposedCommandLine: string, submittedCommandLine?: string) {
        const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;

        const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId: trajectoryId,
                stepIndex,
                interaction: {
                    case: "runCommand",
                    value: new CascadeRunCommandInteraction({
                        proposedCommandLine: proposedCommandLine,
                        submittedCommandLine: submittedCommandLine || proposedCommandLine,
                        confirm: true,
                    })
                }
            })
        });

        await this.lsClient.handleCascadeUserInteraction(req);
    }

    /**
     * Approves a file permission request.
     */
    async approveFilePermission(stepIndex: number, absolutePathUri: string, scope: PermissionScope = PermissionScope.ONCE) {
        const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;
        const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId: trajectoryId,
                stepIndex,
                interaction: {
                    case: "filePermission",
                    value: new FilePermissionInteraction({
                        absolutePathUri: absolutePathUri,
                        scope,
                        allow: true,
                    })
                }
            })
        });

        await this.lsClient.handleCascadeUserInteraction(req);
    }

    /**
     * Approves an open browser URL request.
     */
    async approveOpenBrowserUrl(stepIndex: number) {
        const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;
        const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId: trajectoryId,
                stepIndex,
                interaction: {
                    case: "openBrowserUrl",
                    value: new CascadeOpenBrowserUrlInteraction({
                        confirm: true,
                    })
                }
            })
        });

        await this.lsClient.handleCascadeUserInteraction(req);
    }

    /**
     * Generic method to handle user interaction response.
     */
    async sendInteraction(stepIndex: number, interactionCase: string, interactionValue: any) {
         const interactionOneof: any = {};
         interactionOneof.case = interactionCase;
         interactionOneof.value = interactionValue;
         const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;

         const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId: trajectoryId,
                stepIndex,
                interaction: interactionOneof
            })
        });
        await this.lsClient.handleCascadeUserInteraction(req);
    }

    /**
     * Cancels the current execution of the cascade.
     */
    async cancel() {
        const req = new CancelCascadeInvocationRequest({
            cascadeId: this.cascadeId,
        });
        await this.lsClient.cancelCascadeInvocation(req);
    }
}
