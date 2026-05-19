
import { EventEmitter } from "events";
import type { PromiseClient } from "@connectrpc/connect";
import { LanguageServerService } from "./gen/exa/language_server_pb/language_server_connect.js";
import {
    SendUserCascadeMessageRequest,
    GetCascadeTrajectoryRequest,
    HandleCascadeUserInteractionRequest,
    CancelCascadeInvocationRequest,
} from "./gen/exa/language_server_pb/language_server_pb.js";
import {
    CascadeUserInteraction,
    CascadeRunCommandInteraction,
    FilePermissionInteraction,
    CascadeOpenBrowserUrlInteraction,
    RequestedInteraction,
    CortexStepStatus,
    CascadeRunStatus,
    PermissionScope,
} from "./gen/exa/cortex_pb/cortex_pb.js";
import { StreamReactiveUpdatesRequest } from "./gen/exa/reactive_component_pb/reactive_component_pb.js";
import {
    Metadata,
    TextOrScopeItem,
    ModelOrAlias,
    Model,
    ConversationalPlannerMode,
    Media
} from "./gen/exa/codeium_common_pb/codeium_common_pb.js";
import {
    CascadeConfig,
    CascadePlannerConfig,
    CascadeConversationalPlannerConfig
} from "./gen/exa/cortex_pb/cortex_pb.js";
import { Trajectory, Step } from "./gen/exa/gemini_coder/proto/trajectory_pb.js";
import { CascadeState } from "./gen/exa/jetski_cortex_pb/jetski_cortex_pb.js";
import {
    CascadeStep,
    toStepStatus,
    toRunStatus,
    CascadeEvents,
    type CascadeEventPayloads,
    type StepType,
    type StepValue,
    type StepStatus,
    type RunStatus,
    type ApprovalRequest,
    type ApprovalType,
    type StepNewEvent,
    type StepUpdateEvent,
    type TextDeltaEvent,
    type ThinkingDeltaEvent,
    type CommandOutputEvent,
    type StatusChangeEvent,
    type RunResult,
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

export interface SendMessageOptions {
    /**
     * Model to use for this turn.
     * - Pass a numeric id (e.g. from `client.getAvailableModels()`),
     * - or a model name key (e.g. `"Gemini_3_Flash"` / one of `MODEL_NAMES`).
     * If omitted, falls back to the cascade's default resolver (set at construction
     * time by `client.startCascade()` / `client.getCascade()`) which resolves to
     * `Gemini_3_Flash` or the first recommended model.
     */
    model?: Model | number | string;
    images?: {
        base64Data?: string;
        dataBytes?: Uint8Array;
        mimeType: string;
        caption?: string; // Maps to description
        uri?: string;
    }[];
}

/**
 * Resolves a model identifier (number id or string name) to a numeric model id
 * accepted by the LS. Wired up by `AntigravityClient` so it has access to
 * `getAvailableModels()`.
 */
export type ModelResolver = (nameOrId: Model | number | string) => Promise<number>;

export class Cascade extends EventEmitter {
    /** 
     * 可利用なイベント名の定数セット。
     * 補完を効かせるために cascade.on(Cascade.Events.Text, ...) のように使用してください。
     */
    static readonly Events = CascadeEvents;

    public state: CascadeState = new CascadeState();
    private isListening = false;
    private abortController: AbortController | null = null;
    private lastEmittedText: Record<number, string> = {};
    private lastEmittedThinking: Record<number, string> = {};
    private lastEmittedStdout: Record<number, string> = {};
    private lastEmittedStderr: Record<number, string> = {};
    private emittedInteractions = new Set<number>();
    private lastStatus: CascadeRunStatus = CascadeRunStatus.UNSPECIFIED;

    // High-level event tracking (Phase 2: step tracking internalized from repl.ts)
    private _lastStepCount: number = 0;
    private _stepStatusMap = new Map<number, CortexStepStatus>();
    private _lastCascadeStatus: CascadeRunStatus = CascadeRunStatus.UNSPECIFIED;

    /**
     * イベントを発火させます。
     * 全てのイベントをバイパスする 'all' と、未購読のステップイベントを拾う 'other' をサポートします。
     */
    public override emit = <K extends keyof CascadeEventPayloads>(
        event: K,
        data: CascadeEventPayloads[K]
    ): boolean => {
        // 1. 本来のイベントを発火
        const handled = super.emit(event as string, data);

        // 2. デバッグ用 'all' イベントを発火 (無限ループ防止のため自分自身は除外)
        if (event !== (CascadeEvents.All as any)) {
            super.emit(CascadeEvents.All, { event: event as string, data });
        }

        // 3. 'other' イベントの処理 (個別 step イベントで、且つ誰も購読していない場合)
        if (typeof event === "string" && event.startsWith("step:") && !handled && (event as string) !== "step:update") {
            super.emit(CascadeEvents.Other, data);
        }

        return handled;
    };

    constructor(
        public readonly cascadeId: string,
        private lsClient: PromiseClient<typeof LanguageServerService>,
        private apiKey: string,
        /**
         * Optional. When set, `sendMessage` without an explicit `model` will
         * call this to obtain a numeric model id. Provided by
         * `AntigravityClient.startCascade()` / `getCascade()`.
         */
        private modelResolver?: ModelResolver,
    ) {
        super();
    }

    // ── 型安全な EventEmitter オーバーロード ──

    on<K extends keyof CascadeEventPayloads>(event: K, listener: (ev: CascadeEventPayloads[K]) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    once<K extends keyof CascadeEventPayloads>(event: K, listener: (ev: CascadeEventPayloads[K]) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this {
        return super.once(event, listener);
    }

    // ──────────────────────────────────────────

    // ── High-level helpers ──

    /**
     * Resolves once the cascade transitions to `idle` (= 1 ターン分の応答完了).
     * If already idle, returns immediately. Optional timeout rejects with an
     * Error if the cascade stays busy longer than `timeoutMs`.
     */
    waitForIdle(opts: { timeoutMs?: number } = {}): Promise<void> {
        if (this.state.status === CascadeRunStatus.IDLE) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const handler = (ev: { status: RunStatus; previousStatus: RunStatus }) => {
                if (ev.status === "idle" && ev.previousStatus !== "idle") {
                    this.off("statusChange", handler as any);
                    if (timer) clearTimeout(timer);
                    resolve();
                }
            };
            this.on("statusChange", handler as any);
            if (opts.timeoutMs && opts.timeoutMs > 0) {
                timer = setTimeout(() => {
                    this.off("statusChange", handler as any);
                    reject(new Error(`waitForIdle: timeout after ${opts.timeoutMs}ms`));
                }, opts.timeoutMs);
            }
        });
    }

    /**
     * Waits for the current turn to complete by ensuring the cascade transitions 
     * away from idle (i.e. starts running/processing) and then returns to idle.
     */
    waitForTurnComplete(opts: { timeoutMs?: number } = {}): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            let hasLeftIdle = this.state.status !== CascadeRunStatus.IDLE;

            const handler = (ev: { status: RunStatus; previousStatus: RunStatus }) => {
                if (ev.status !== "idle") {
                    hasLeftIdle = true;
                }
                if (hasLeftIdle && ev.status === "idle") {
                    this.off("statusChange", handler as any);
                    if (timer) clearTimeout(timer);
                    resolve();
                }
            };

            this.on("statusChange", handler as any);

            if (opts.timeoutMs && opts.timeoutMs > 0) {
                timer = setTimeout(() => {
                    this.off("statusChange", handler as any);
                    reject(new Error(`waitForTurnComplete: timeout after ${opts.timeoutMs}ms`));
                }, opts.timeoutMs);
            }
        });
    }

    /**
     * Cancels the in-flight turn and waits for the cascade to return to idle.
     * Equivalent to `await cascade.cancel(); await cascade.waitForIdle()`.
     */
    async cancelAndWait(opts: { timeoutMs?: number } = {}): Promise<void> {
        await this.cancel();
        await this.waitForIdle(opts);
    }

    /**
     * High-level "send + wait" wrapper. Sends a message, waits for the cascade
     * to return to idle, and returns the response text, the new steps added in
     * this turn, and the final status. Lets consumers avoid wiring up event
     * listeners for one-shot turns.
     *
     * For long tasks pass `timeoutMs` to bound the wait. On timeout the
     * cascade is NOT cancelled automatically — call `cascade.cancel()` yourself
     * if you want to abort.
     */
    async run(
        text: string,
        opts: SendMessageOptions & { timeoutMs?: number } = {}
    ): Promise<RunResult> {
        const startStepCount = this.state.trajectory?.steps?.length ?? 0;
        let collected = "";
        const textHandler = (ev: { delta: string; fullText: string; stepIndex: number }) => {
            if (ev.stepIndex >= startStepCount) collected += ev.delta;
        };
        this.on("text", textHandler as any);

        let timedOut = false;
        try {
            await this.sendMessage(text, opts);
            try {
                await this.waitForTurnComplete({ timeoutMs: opts.timeoutMs });
            } catch (e: any) {
                if (e?.message?.startsWith("waitForTurnComplete: timeout")) {
                    timedOut = true;
                } else {
                    throw e;
                }
            }

            const allSteps = this.state.trajectory?.steps ?? [];
            const newSteps = allSteps
                .slice(startStepCount)
                .map((s: Step, i: number) => new CascadeStep(s, startStepCount + i));

            return {
                text: collected,
                newSteps,
                finalStatus: toRunStatus(this.state.status),
                timedOut,
            };
        } finally {
            this.off("text", textHandler as any);
        }
    }

    /**
     * Starts listening to reactive updates for this cascade.
     *
     * Reactive streams are **finite** — the LS closes the stream after each
     * AI turn completes. The official Antigravity client handles this by
     * immediately reconnecting in a retry loop. On reconnection, the initial
     * sync delivers the full state including fields (like `response`) that
     * may not have been included in the final diff before the stream closed.
     */
    async listen() {
        if (this.isListening) return;
        this.isListening = true;
        this.abortController = new AbortController();

        const retryDelay = 1000;

        while (this.isListening) {
            // Use StreamAgentStateUpdates (modern) for real-time synchronization
            const req: any = {
                conversationId: this.cascadeId,
                subscriberId: this.cascadeId,
                trajectoryVerbosity: 3, // FULL
            };

            try {
                const signal = this.abortController.signal;
                // @ts-ignore - The method name might vary across SDK generations
                for await (const res of this.lsClient.streamAgentStateUpdates(req, { signal })) {
                    const update = res.update;
                    if (!update) continue;

                    // 1. Sync Status
                    if (update.status !== undefined) {
                        this.state.status = update.status as any;
                    }

                    // 2. Sync Trajectory Steps (Manual Hydration)
                    const mainTraj = update.mainTrajectoryUpdate;
                    if (mainTraj?.stepsUpdate) {
                        if (!this.state.trajectory) {
                            this.state.trajectory = new Trajectory();
                        }
                        // Important: Sync trajectoryId from update to allow correct interactions
                        if (update.trajectoryId) {
                            this.state.trajectory.trajectoryId = update.trajectoryId;
                        }
                        const { steps, indices } = mainTraj.stepsUpdate;
                        indices.forEach((idx: number, i: number) => {
                            this.state.trajectory!.steps[idx] = steps[i];
                        });
                    }

                    // 3. Emit internal events for deltas and interactions
                    this.emitEvents();
                }
            } catch (err: any) {
                // If we were explicitly disposed, ignore connection errors and exit immediately
                if (!this.isListening) {
                    break;
                }
                if (err?.code === 1 || (err?.code === 2 && err?.message?.includes("canceled"))) {
                    break;
                }
                this.emit("error", err);
            }

            if (!this.isListening) break;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        this.isListening = false;
    }

    /**
     * Stops the reactive updates listener loop and cleans up active listeners and abort signals.
     */
    dispose() {
        this.isListening = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.removeAllListeners();
    }

    private emitEvents() {
        this.emit(CascadeEvents.RawUpdate, this.state);

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
            this.emit("done", {});
        }
        this.lastStatus = currentStatus;

        // New high-level event
        if (currentStatus !== this._lastCascadeStatus) {
            const prev = this._lastCascadeStatus;
            this._lastCascadeStatus = currentStatus;
            this.emit(CascadeEvents.StatusChange, {
                status: toRunStatus(currentStatus),
                previousStatus: toRunStatus(prev),
            });
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
                const cascadeStep = new CascadeStep(step, i);

                // 1. 汎用イベント
                this.emit("stepNew", {
                    step: cascadeStep,
                } satisfies StepNewEvent);

                // 2. 個別ツールイベント (例: step:runCommand)
                if (cascadeStep.type !== "unknown") {
                    // 個別イベントはフラットに CascadeStep 自体をペイロードとして送る
                    this.emit(`step:${cascadeStep.type}` as any, cascadeStep);
                }
            }
            this._lastStepCount = steps.length;
        }

        // Detect status changes
        steps.forEach((step: Step, index: number) => {
            if (!step) return;
            const prevStatus = this._stepStatusMap.get(index);
            if (prevStatus !== undefined && prevStatus !== step.status) {
                this.emit(CascadeEvents.StepUpdate, {
                    step: new CascadeStep(step, index),
                    previousStatus: toStepStatus(prevStatus),
                });
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
                // 自動承認のために、もし interactionCase が無くても WAITING なら進められるように特別な対応が必要かもしれない
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
                this.emit(CascadeEvents.Interaction, request);
            }
        });
    }

    private buildInlineFilePermissionRequest(step: Step, stepIndex: number, spec: any): ApprovalRequest {
        const cascadeStep = new CascadeStep(step, stepIndex);
        const cascade = this;
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
                this.emit(CascadeEvents.CommandOutput, {
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
                this.emit(CascadeEvents.CommandOutput, {
                    fullText: stderr,
                    delta,
                    stream: "stderr",
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
            // 本家UIは modifiedResponse を表示に使用する。
            // modifiedResponse は LS が response を後処理して生成するフィールド。
            // response はストリーム終了前に空のままだが、modifiedResponse は
            // 再接続後の初期同期で配信される。
            const response = planner.modifiedResponse || planner.response || "";
            const thinking = planner.thinking || "";

            // Text Delta
            const lastText = this.lastEmittedText[index] || "";
            if (response.length > lastText.length) {
                const delta = response.substring(lastText.length);
                this.emit(CascadeEvents.Text, {
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
                this.emit(CascadeEvents.Thinking, {
                    delta,
                    fullText: thinking,
                    stepIndex: index,
                });
                this.lastEmittedThinking[index] = thinking;
            }
        });
    }



    async sendMessage(text: string, options: SendMessageOptions = {}) {
        const metadata = new Metadata({
            apiKey: this.apiKey,
            ideName: "vscode",
            ideVersion: "1.107.0",
            extensionName: "antigravity",
            extensionVersion: "0.2.0",
        });

        // Resolve model id: numeric → use as-is; string → look up via resolver;
        // omitted → resolver default (typically Gemini_3_Flash).
        let modelId: number;
        if (typeof options.model === "number") {
            modelId = options.model;
        } else if (typeof options.model === "string") {
            if (!this.modelResolver) {
                throw new Error(
                    `sendMessage: model "${options.model}" given as a string but ` +
                    `this Cascade has no modelResolver. Use AntigravityClient.startCascade() ` +
                    `or pass options.model as a numeric id.`
                );
            }
            modelId = await this.modelResolver(options.model);
        } else {
            if (!this.modelResolver) {
                throw new Error(
                    "sendMessage: no model specified and no default resolver available. " +
                    "Pass options.model (number or name) or construct this Cascade via AntigravityClient.startCascade()."
                );
            }
            // Resolver returns the default model id when called with undefined/empty.
            modelId = await this.modelResolver("");
        }

        // Convert options.images to Media representations
        const mediaObjects = (options.images || []).map(img => {
            let uint8Array = img.dataBytes;
            if (!uint8Array && img.base64Data) {
                const buffer = Buffer.from(img.base64Data, 'base64');
                uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.length);
            }

            return new Media({
                mimeType: img.mimeType,
                description: img.caption || "",
                uri: img.uri || "",
                payload: {
                    case: "inlineData",
                    value: uint8Array || new Uint8Array()
                }
            });
        });

        const req = new SendUserCascadeMessageRequest({
            cascadeId: this.cascadeId,
            metadata,
            items: [
                new TextOrScopeItem({
                    chunk: { case: "text", value: text }
                })
            ],
            media: mediaObjects,
            cascadeConfig: new CascadeConfig({
                plannerConfig: new CascadePlannerConfig({
                    plannerTypeConfig: {
                        case: "conversational",
                        value: new CascadeConversationalPlannerConfig({
                            plannerMode: 1, // DEFAULT
                        })
                    },
                    requestedModel: new ModelOrAlias({
                        choice: {
                            case: "model",
                            value: modelId,
                        }
                    })
                })
            }),
            blocking: false,
            clientType: 1, // IDE
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
        const step = this.state.trajectory?.steps[stepIndex];
        if (!step) throw new Error(`Step ${stepIndex} not found`);

        const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;
        const interactionCase = step.requestedInteraction?.interaction?.case;

        // If the server is asking for a 'permission' interaction (modern LS), we must respond with 'permission'.
        // This solves "input not registered for step X" errors.
        if (interactionCase === "permission") {
            await this.sendInteraction(stepIndex, "permission", {
                allow: true,
                scope: 1, // PermissionScope.ONCE
            });
        } else {
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
     * Rejects a command execution request.
     */
    async denyCommand(stepIndex: number, proposedCommandLine: string, submittedCommandLine?: string) {
        const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;
        const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId,
                stepIndex,
                interaction: {
                    case: "runCommand",
                    value: new CascadeRunCommandInteraction({
                        proposedCommandLine,
                        submittedCommandLine: submittedCommandLine || proposedCommandLine,
                        confirm: false,
                    }),
                },
            }),
        });
        await this.lsClient.handleCascadeUserInteraction(req);
    }

    /**
     * Rejects a file permission request.
     */
    async denyFilePermission(stepIndex: number, absolutePathUri: string) {
        const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;
        const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId,
                stepIndex,
                interaction: {
                    case: "filePermission",
                    value: new FilePermissionInteraction({
                        absolutePathUri,
                        scope: PermissionScope.ONCE,
                        allow: false,
                    }),
                },
            }),
        });
        await this.lsClient.handleCascadeUserInteraction(req);
    }

    /**
     * Rejects an open browser URL request.
     */
    async denyOpenBrowserUrl(stepIndex: number) {
        const trajectoryId = this.state.trajectory?.trajectoryId || this.cascadeId;
        const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId,
                stepIndex,
                interaction: {
                    case: "openBrowserUrl",
                    value: new CascadeOpenBrowserUrlInteraction({
                        confirm: false,
                    }),
                },
            }),
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

         // Use the synced trajectoryId from state, falling back to cascadeId
         const trajectoryId = (this.state as any).trajectoryId || this.state.trajectory?.trajectoryId || this.cascadeId;

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
