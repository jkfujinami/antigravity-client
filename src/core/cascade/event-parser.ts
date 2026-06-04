import { EventEmitter } from "events";
import { Cascade } from "./index.js";
import { CascadeState } from "../../gen/exa/jetski_cortex_pb/jetski_cortex_pb.js";
import {
    CascadeUserInteraction,
    CascadeRunCommandInteraction,
    FilePermissionInteraction,
    CascadeOpenBrowserUrlInteraction,
    RequestedInteraction,
    CortexStepStatus,
    CascadeRunStatus,
    PermissionScope,
} from "../../gen/exa/cortex_pb/cortex_pb.js";
import { Step } from "../../gen/exa/gemini_coder/proto/trajectory_pb.js";
import {
    CascadeStep,
    toStepStatus,
    toRunStatus,
    CascadeEvents,
    StepType,
    StepValue,
    StepStatus,
    RunStatus,
    ApprovalRequest,
    ApprovalType,
    StepNewEvent,
    StepUpdateEvent,
    TextDeltaEvent,
    ThinkingDeltaEvent,
    CommandOutputEvent,
    StatusChangeEvent,
    RunResult,
} from "../../types/index.js";

export class CascadeEventParser {
    private lastEmittedText: Record<number, string> = {};
    private lastEmittedThinking: Record<number, string> = {};
    private lastEmittedStdout: Record<number, string> = {};
    private lastEmittedStderr: Record<number, string> = {};
    private emittedInteractions = new Set<number>();
    private lastStatus: CascadeRunStatus = CascadeRunStatus.UNSPECIFIED;

    private _lastStepCount: number = 0;
    private _stepStatusMap = new Map<number, CortexStepStatus>();
    private _lastCascadeStatus: CascadeRunStatus = CascadeRunStatus.UNSPECIFIED;

    constructor(private cascade: Cascade) {}

    public parseState(state: CascadeState) {
        this.emitEvents();
    }

    private emitEvents() {
        this.cascade.emit(CascadeEvents.RawUpdate, this.cascade.state);

        this.emitStatusChange();

        if (!this.cascade.state.trajectory?.steps) return;

        this.emitStepEvents();
        this.emitApprovalRequests();
        this.emitCommandOutputDeltas();
        this.emitTextDeltas();
    }

    private emitStatusChange() {
        const currentStatus = this.cascade.state.status;

        // Legacy done event (compatibility)
        if (currentStatus === CascadeRunStatus.IDLE && this.lastStatus !== CascadeRunStatus.IDLE) {
            this.cascade.emit("done", {});
        }
        this.lastStatus = currentStatus;

        // New high-level event
        if (currentStatus !== this._lastCascadeStatus) {
            const prev = this._lastCascadeStatus;
            this._lastCascadeStatus = currentStatus;
            this.cascade.emit(CascadeEvents.StatusChange, {
                status: toRunStatus(currentStatus),
                previousStatus: toRunStatus(prev),
            });
        }
    }

    private emitStepEvents() {
        const steps = this.cascade.state.trajectory!.steps;

        // Detect new steps
        if (steps.length > this._lastStepCount) {
            for (let i = this._lastStepCount; i < steps.length; i++) {
                const step = steps[i];
                if (!step) continue;
                this._stepStatusMap.set(i, step.status);
                const cascadeStep = new CascadeStep(step, i);

                // 1. Generic event
                this.cascade.emit("stepNew", {
                    step: cascadeStep,
                } satisfies StepNewEvent);

                // 2. Per-tool event (e.g. step:runCommand)
                if (cascadeStep.type !== "unknown") {
                    // Per-tool events send the CascadeStep itself as a flat payload
                    this.cascade.emit(`step:${cascadeStep.type}` as any, cascadeStep);
                }
            }
            this._lastStepCount = steps.length;
        }

        // Detect status changes
        steps.forEach((step: Step, index: number) => {
            if (!step) return;
            const prevStatus = this._stepStatusMap.get(index);
            if (prevStatus !== undefined && prevStatus !== step.status) {
                this.cascade.emit(CascadeEvents.StepUpdate, {
                    step: new CascadeStep(step, index),
                    previousStatus: toStepStatus(prevStatus),
                });
            }
            this._stepStatusMap.set(index, step.status);
        });
    }

    private emitApprovalRequests() {
        const steps = this.cascade.state.trajectory!.steps;

        steps.forEach((step: Step, index: number) => {
            if (!step) return;

            const status = step.status;
            const interactionCase = step.requestedInteraction?.interaction?.case || "none";

            // Debug: log all steps that have PENDING/RUNNING/WAITING status
            const isInteractiveState =
                status === CortexStepStatus.PENDING ||
                status === CortexStepStatus.RUNNING ||
                status === CortexStepStatus.WAITING;

            if (isInteractiveState && !this.emittedInteractions.has(index)) {
                // Interactive step detected
            }

            const inlineFilePermission = (step.step?.value as any)?.filePermissionRequest;

            if (!isInteractiveState) return;
            if (!step.requestedInteraction?.interaction?.case && !inlineFilePermission) {
                // For auto-approval we may eventually need special handling so a WAITING step can proceed even without an interactionCase
                return;
            }
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

            // High-level ApprovalRequest event
            let request: ApprovalRequest | null = null;
            if (step.requestedInteraction?.interaction?.case) {
                request = this.buildApprovalRequest(step, index, autoRun, needsApproval, commandLine);
            } else if (inlineFilePermission) {
                request = this.buildInlineFilePermissionRequest(step, index, inlineFilePermission);
            }

            if (request) {
                this.cascade.emit(CascadeEvents.Interaction, request);
            }
        });
    }

    private buildInlineFilePermissionRequest(step: Step, stepIndex: number, spec: any): ApprovalRequest {
        const cascadeStep = new CascadeStep(step, stepIndex);
        const cascade = this.cascade;
        const opStr = spec.isDirectory ? "Read Directory" : "Read File";

        return {
            type: "file_permission",
            description: `${opStr}: ${spec.absolutePathUri}`,
            stepIndex,
            step: cascadeStep,
            autoRun: false,
            needsApproval: true,
            filePath: spec.absolutePathUri,
            isDirectory: spec.isDirectory,
            async approve(scope: "once" | "conversation" | "global" = "once") {
                const scopeValue = {
                    "once": PermissionScope.ONCE,
                    "conversation": PermissionScope.CONVERSATION,
                    "global": PermissionScope.CONVERSATION, // No global scope in enum, fallback to conversation
                }[scope] || PermissionScope.UNSPECIFIED;

                await cascade.approveFilePermission(stepIndex, spec.absolutePathUri, scopeValue);
            },
            async deny() {
                await cascade.denyFilePermission(stepIndex, spec.absolutePathUri);
            }
        };
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
        const cascade = this.cascade;

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
                    async deny() {
                        await cascade.denyCommand(stepIndex, commandLine, commandLine);
                    },
                };

            case "permission": {
                const spec = interaction.interaction.value as any;
                const resource = spec.resource;
                const action: string = resource?.action || "unknown";
                const target: string = resource?.target || "resource";

                // File-related permission actions are surfaced as `file_permission`
                // so consumers can discriminate by `type` instead of parsing description.
                const isFileAction =
                    /(read|write|create|delete|modify|append|edit)_(file|dir|directory|path)/i.test(action) ||
                    /^(file|dir|directory)_/i.test(action);
                const isCommandAction = /^(command|shell|exec|run_command)$/i.test(action);

                let reqType: ApprovalType = "other";
                if (isFileAction) {
                    reqType = "file_permission";
                } else if (isCommandAction) {
                    reqType = "run_command";
                }

                return {
                    type: reqType,
                    description: `Permission Needed: ${action} on ${target}`,
                    stepIndex,
                    step: cascadeStep,
                    autoRun: false,
                    needsApproval: true,
                    filePath: isFileAction ? target : undefined,
                    commandLine: isCommandAction ? target : undefined,
                    async approve(scope: "once" | "conversation" | "global" = "once") {
                        const scopeValue = {
                            "once": 1, // PermissionScope.ONCE
                            "conversation": 2, // PermissionScope.CONVERSATION
                            "global": 2, // No global in some versions, fallback
                        }[scope] || 0;

                        await cascade.sendInteraction(stepIndex, "permission", {
                            allow: true,
                            scope: scopeValue,
                        });
                    },
                    async deny() {
                        await cascade.sendInteraction(stepIndex, "permission", {
                            allow: false,
                            scope: 0,
                        });
                    },
                };
            }

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
                    async deny() {
                        await cascade.denyFilePermission(stepIndex, pathUri);
                    },
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
                    async deny() {
                        await cascade.denyOpenBrowserUrl(stepIndex);
                    },
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

    private emitCommandOutputDeltas() {
        const steps = this.cascade.state.trajectory!.steps;

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
                this.cascade.emit(CascadeEvents.CommandOutput, {
                    fullText: stdout,
                    delta,
                    stream: "stdout",
                    stepIndex: index
                });
                this.lastEmittedStdout[index] = stdout;
            }

            // Stderr delta
            const lastStderr = this.lastEmittedStderr[index] || "";
            if (stderr.length > lastStderr.length) {
                const delta = stderr.substring(lastStderr.length);
                this.cascade.emit(CascadeEvents.CommandOutput, {
                    fullText: stderr,
                    delta,
                    stream: "stderr",
                    stepIndex: index
                });
                this.lastEmittedStderr[index] = stderr;
            }
        });
    }

    private emitTextDeltas() {
        const steps = this.cascade.state.trajectory!.steps;

        steps.forEach((step: Step, index: number) => {
            if (!step) return;
            if (step.step?.case !== "plannerResponse") return;
            const planner = step.step.value as any;
            // The official UI renders `modifiedResponse`, a field the LS produces
            // by post-processing `response`. `response` stays empty until the
            // stream ends, but `modifiedResponse` is delivered in the initial
            // sync after reconnection.
            const response = planner.modifiedResponse || planner.response || "";
            const thinking = planner.thinking || "";

            // Text Delta
            const lastText = this.lastEmittedText[index] || "";
            if (response.length > lastText.length) {
                const delta = response.substring(lastText.length);
                this.cascade.emit(CascadeEvents.Text, {
                    delta,
                    fullText: response,
                    stepIndex: index,
                });
                this.lastEmittedText[index] = response;
            }

            // Thinking Delta
            const lastThinking = this.lastEmittedThinking[index] || "";
            if (thinking.length > lastThinking.length) {
                const delta = thinking.substring(lastThinking.length);
                this.cascade.emit(CascadeEvents.Thinking, {
                    delta,
                    fullText: thinking,
                    stepIndex: index,
                });
                this.lastEmittedThinking[index] = thinking;
            }
        });
    }
}
