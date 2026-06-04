
import { EventEmitter } from "events";

import { CascadeStreamHandler } from "./stream-handler.js";
import { CascadeEventParser } from "./event-parser.js";

import type { PromiseClient } from "@connectrpc/connect";
import { LanguageServerService } from "../../gen/exa/language_server_pb/language_server_connect.js";
import {
    SendUserCascadeMessageRequest,
    GetCascadeTrajectoryRequest,
    HandleCascadeUserInteractionRequest,
    CancelCascadeInvocationRequest,
} from "../../gen/exa/language_server_pb/language_server_pb.js";
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
import { StreamReactiveUpdatesRequest } from "../../gen/exa/reactive_component_pb/reactive_component_pb.js";
import {
    Metadata,
    TextOrScopeItem,
    ModelOrAlias,
    Model,
    ConversationalPlannerMode,
    Media
} from "../../gen/exa/codeium_common_pb/codeium_common_pb.js";
import {
    CascadeConfig,
    CascadePlannerConfig,
    CascadeConversationalPlannerConfig
} from "../../gen/exa/cortex_pb/cortex_pb.js";
import { Trajectory, Step } from "../../gen/exa/gemini_coder/proto/trajectory_pb.js";
import { CascadeState } from "../../gen/exa/jetski_cortex_pb/jetski_cortex_pb.js";
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
} from "../../types/index.js";

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
     * Constant set of available event names.
     * Use it as `cascade.on(Cascade.Events.Text, ...)` to get autocompletion.
     */
    static readonly Events = CascadeEvents;

    public state: CascadeState = new CascadeState();
    private streamHandler: CascadeStreamHandler;
    private eventParser: CascadeEventParser;
                                
    // High-level event tracking (Phase 2: step tracking internalized from repl.ts)
            
    /**
     * Emits an event.
     * Also supports the 'all' meta-event (mirrors every event) and the 'other'
     * event (catches per-step events that no one is subscribed to).
     */
    public override emit = <K extends keyof CascadeEventPayloads>(
        event: K,
        data: CascadeEventPayloads[K]
    ): boolean => {
        // 1. Emit the original event
        const handled = super.emit(event as string, data);

        // 2. Emit the debug 'all' event (exclude itself to avoid an infinite loop)
        if (event !== (CascadeEvents.All as any)) {
            super.emit(CascadeEvents.All, { event: event as string, data });
        }

        // 3. Handle the 'other' event (a per-step event that nobody subscribed to)
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
        this.eventParser = new CascadeEventParser(this);
        this.streamHandler = new CascadeStreamHandler(
            cascadeId, lsClient, apiKey,
            (newState) => {
                this.state = newState;
                this.eventParser.parseState(newState);
            },
            (err) => this.emit(CascadeEvents.Error, err),
            () => {
                this.state.status = CascadeRunStatus.IDLE;
                this.emit(CascadeEvents.Done, {});
            }
        );
    }

    // ── Type-safe EventEmitter overloads ──

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
     * Resolves once the cascade transitions to `idle` (i.e. one turn completed).
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

    async listen() {
        return this.streamHandler.listen();
    }

    dispose() {
        this.streamHandler.dispose();
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

    /**
     * Stops the reactive updates listener loop and cleans up active listeners and abort signals.
     */


    // ── Status Change ──


    // ── Step Tracking ──


    // ── Approval Requests ──




    // ── Command Output Deltas ──


    // ── Text / Thinking Deltas ──




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
