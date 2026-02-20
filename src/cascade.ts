
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
import {
    CascadeStep,
    toStepStatus,
    toRunStatus,
    type ApprovalRequest,
    type StepNewEvent,
    type StepUpdateEvent,
    type TextDeltaEvent,
    type ThinkingDeltaEvent,
    type CommandOutputEvent,
    type StatusChangeEvent,
} from "./types.js";

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
    private lastEmittedStdout: Record<number, string> = {};
    private lastEmittedStderr: Record<number, string> = {};
    private emittedInteractions = new Set<number>();
    private lastStatus: CascadeRunStatus = CascadeRunStatus.UNSPECIFIED;

    // High-level event tracking (Phase 2: step tracking internalized from repl.ts)
    private _lastStepCount: number = 0;
    private _stepStatusMap: Map<number, CortexStepStatus> = new Map();
    private _lastCascadeStatus: CascadeRunStatus = CascadeRunStatus.UNSPECIFIED;

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

        this.emitStatusChange();

        if (!this.state.trajectory?.steps) return;

        this.emitStepEvents();
        this.emitApprovalRequests();
        this.emitCommandOutputDeltas();
        this.emitTextDeltas();
    }

    // ── Status Change ──

    private emitStatusChange() {
        const currentStatus = this.state.status;

        // Legacy done event (compatibility)
        if (currentStatus === CascadeRunStatus.IDLE && this.lastStatus !== CascadeRunStatus.IDLE) {
            this.emit("done");
        }
        this.lastStatus = currentStatus;

        // New high-level event
        if (currentStatus !== this._lastCascadeStatus) {
            const prev = this._lastCascadeStatus;
            this._lastCascadeStatus = currentStatus;
            this.emit("status_change", {
                status: toRunStatus(currentStatus),
                previousStatus: toRunStatus(prev),
            } satisfies StatusChangeEvent);
        }
    }

    // ── Step Tracking ──

    private emitStepEvents() {
        const steps = this.state.trajectory!.steps;

        // Detect new steps
        if (steps.length > this._lastStepCount) {
            for (let i = this._lastStepCount; i < steps.length; i++) {
                const step = steps[i];
                if (!step) continue;
                this._stepStatusMap.set(i, step.status);
                this.emit("step:new", {
                    step: new CascadeStep(step, i),
                } satisfies StepNewEvent);
            }
            this._lastStepCount = steps.length;
        }

        // Detect status changes
        steps.forEach((step: Step, index: number) => {
            if (!step) return;
            const prevStatus = this._stepStatusMap.get(index);
            if (prevStatus !== undefined && prevStatus !== step.status) {
                this.emit("step:update", {
                    step: new CascadeStep(step, index),
                    previousStatus: toStepStatus(prevStatus),
                } satisfies StepUpdateEvent);
            }
            this._stepStatusMap.set(index, step.status);
        });
    }

    // ── Approval Requests ──

    private emitApprovalRequests() {
        const steps = this.state.trajectory!.steps;

        steps.forEach((step: Step, index: number) => {
            if (!step) return;

            const status = step.status;
            const isInteractiveState =
                status === CortexStepStatus.PENDING ||
                status === CortexStepStatus.RUNNING ||
                status === CortexStepStatus.WAITING;

            if (!isInteractiveState) return;
            if (!step.requestedInteraction?.interaction?.case) return;
            if (this.emittedInteractions.has(index)) return;

            // Compute autoRun / needsApproval / commandLine for legacy event
            let autoRun = false;
            let commandLine = "";
            const runCommand = (step as any).runCommand ||
                               (step.step?.case === "runCommand" ? step.step.value : null);
            if (runCommand) {
                autoRun = runCommand.shouldAutoRun;
                commandLine = runCommand.proposedCommandLine || runCommand.commandLine;
            }
            let needsApproval = !autoRun;
            if (status === CortexStepStatus.WAITING) {
                needsApproval = true;
            }

            this.emittedInteractions.add(index);

            // Legacy event (compatibility)
            this.emit("interaction", {
                type: "interaction",
                interaction: step.requestedInteraction,
                stepIndex: index,
                autoRun,
                needsApproval,
                commandLine
            });

            // New high-level event
            const request = this.buildApprovalRequest(step, index, autoRun, needsApproval, commandLine);
            if (request) {
                this.emit("approval:needed", request);
            }
        });
    }

    private buildApprovalRequest(
        step: Step,
        stepIndex: number,
        autoRun: boolean,
        needsApproval: boolean,
        commandLine: string
    ): ApprovalRequest | null {
        const interaction = step.requestedInteraction!;
        const interactionCase = interaction.interaction.case;
        const cascadeStep = new CascadeStep(step, stepIndex);
        const cascade = this;

        switch (interactionCase) {
            case "runCommand":
                return {
                    type: "run_command",
                    description: `Run Command: ${commandLine}`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun,
                    needsApproval,
                    commandLine,
                    async approve() {
                        await cascade.approveCommand(stepIndex, commandLine, commandLine);
                    },
                    async deny() { /* no-op */ },
                };

            case "filePermission": {
                const spec = interaction.interaction.value as any;
                const pathUri: string = spec.absolutePathUri || "";
                const isDir: boolean = spec.isDirectory || false;
                return {
                    type: "file_permission",
                    description: `File Access: ${pathUri}${isDir ? " (directory)" : ""}`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun: false,
                    needsApproval: true,
                    filePath: pathUri,
                    isDirectory: isDir,
                    async approve(scope?: "once" | "conversation") {
                        const permScope = scope === "conversation"
                            ? PermissionScope.CONVERSATION
                            : PermissionScope.ONCE;
                        await cascade.approveFilePermission(stepIndex, pathUri, permScope);
                    },
                    async deny() { /* no-op */ },
                };
            }

            case "openBrowserUrl": {
                let url = "Unknown URL";
                if (step.step?.case === "openBrowserUrl") {
                    url = (step.step.value as any).url || url;
                }
                return {
                    type: "open_browser_url",
                    description: `Open Browser: ${url}`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun: false,
                    needsApproval: true,
                    url,
                    async approve() {
                        await cascade.approveOpenBrowserUrl(stepIndex);
                    },
                    async deny() { /* no-op */ },
                };
            }

            case "executeBrowserJavascript":
            case "captureBrowserScreenshot":
            case "clickBrowserPixel":
            case "browserAction":
            case "openBrowserSetup":
            case "confirmBrowserSetup":
                return {
                    type: "browser_action",
                    description: `Browser Action: ${interactionCase}`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun: false,
                    needsApproval: true,
                    async approve() {
                        await cascade.sendInteraction(stepIndex, interactionCase!, interaction.interaction.value);
                    },
                    async deny() { /* no-op */ },
                };

            case "sendCommandInput":
                return {
                    type: "send_command_input",
                    description: `Send Command Input`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun: false,
                    needsApproval: true,
                    async approve() {
                        await cascade.sendInteraction(stepIndex, interactionCase!, interaction.interaction.value);
                    },
                    async deny() { /* no-op */ },
                };

            case "mcp":
                return {
                    type: "mcp",
                    description: `MCP Tool Interaction`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun: false,
                    needsApproval: true,
                    async approve() {
                        await cascade.sendInteraction(stepIndex, interactionCase!, interaction.interaction.value);
                    },
                    async deny() { /* no-op */ },
                };

            default:
                return {
                    type: "other",
                    description: `Unknown Interaction: ${interactionCase}`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun: false,
                    needsApproval: true,
                    async approve() {
                        if (interactionCase) {
                            await cascade.sendInteraction(stepIndex, interactionCase, interaction.interaction.value);
                        }
                    },
                    async deny() { /* no-op */ },
                };
        }
    }

    // ── Command Output Deltas ──

    private emitCommandOutputDeltas() {
        const steps = this.state.trajectory!.steps;

        steps.forEach((step: Step, index: number) => {
            if (!step) return;
            const runCommandPlain = (step as any).runCommand ||
                                    (step.step?.case === "runCommand" ? step.step.value : null);
            if (!runCommandPlain) return;

            const stdout = runCommandPlain.stdout || "";
            const stderr = runCommandPlain.stderr || "";

            // Stdout delta
            const lastStdout = this.lastEmittedStdout[index] || "";
            if (stdout.length > lastStdout.length) {
                const delta = stdout.substring(lastStdout.length);
                // Legacy event (compatibility)
                this.emit("command_output", {
                    type: "command_output",
                    text: stdout,
                    delta,
                    outputType: "stdout",
                    stepIndex: index
                });
                this.lastEmittedStdout[index] = stdout;
            }

            // Stderr delta
            const lastStderr = this.lastEmittedStderr[index] || "";
            if (stderr.length > lastStderr.length) {
                const delta = stderr.substring(lastStderr.length);
                // Legacy event (compatibility)
                this.emit("command_output", {
                    type: "command_output",
                    text: stderr,
                    delta,
                    outputType: "stderr",
                    stepIndex: index
                });
                this.lastEmittedStderr[index] = stderr;
            }
        });
    }

    // ── Text / Thinking Deltas ──

    private emitTextDeltas() {
        const steps = this.state.trajectory!.steps;

        steps.forEach((step: Step, index: number) => {
            if (!step) return;
            if (step.step?.case !== "plannerResponse") return;
            const planner = step.step.value as any;
            const response = planner.response || "";
            const thinking = planner.thinking || "";

            // Text Delta
            const lastText = this.lastEmittedText[index] || "";
            if (response.length > lastText.length) {
                const delta = response.substring(lastText.length);
                // Legacy event (compatibility)
                this.emit("text", {
                    text: response,
                    delta,
                    stepIndex: index
                });
                // New high-level event
                this.emit("text:delta", {
                    delta,
                    fullText: response,
                    stepIndex: index,
                } satisfies TextDeltaEvent);
                this.lastEmittedText[index] = response;
            }

            // Thinking Delta
            const lastThinking = this.lastEmittedThinking[index] || "";
            if (thinking.length > lastThinking.length) {
                const delta = thinking.substring(lastThinking.length);
                // Legacy event (compatibility)
                this.emit("thinking", {
                    text: thinking,
                    delta,
                    stepIndex: index
                });
                // New high-level event
                this.emit("thinking:delta", {
                    delta,
                    fullText: thinking,
                    stepIndex: index,
                } satisfies ThinkingDeltaEvent);
                this.lastEmittedThinking[index] = thinking;
            }
        });
    }

    async sendMessage(text: string, options: { model?: Model } = {}) {
        const metadata = new Metadata({
            apiKey: this.apiKey,
            ideName: "vscode",
            ideVersion: "1.107.0",
            extensionName: "antigravity",
            extensionVersion: "0.2.0",
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
