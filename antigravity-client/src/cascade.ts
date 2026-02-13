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
    type: "text" | "thinking" | "status" | "error" | "done" | "update";
    text?: string;
    delta?: string;
    status?: string;
    error?: any;
    state?: any;
}

export class Cascade extends EventEmitter {
    public state: CascadeState = new CascadeState();
    private isListening = false;
    private lastEmittedText: Record<number, string> = {};
    private lastEmittedThinking: Record<number, string> = {};

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
                    // We apply the diff to our local state
                    applyMessageDiff(this.state, res.diff, CascadeState);

                    // Trigger events based on diff contents
                    this.emitEvents();
                }
            }
        } catch (err) {
            this.emit("error", err);
        } finally {
            this.isListening = false;
        }
    }

    private emitEvents() {
        this.emit("update", this.state);

        if (!this.state.trajectory?.steps) return;

        this.state.trajectory.steps.forEach((step: any, index: number) => {
            if (step && step.step?.case === "plannerResponse") {
                const response = step.step.value.response || "";
                const thinking = step.step.value.thinking || "";

                // Handle Text Delta
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

                // Handle Thinking Delta
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
                            value: options.model || Model.PLACEHOLDER_M18 // Gemini 3 Flash
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
        });
        const response = await this.lsClient.getCascadeTrajectory(req);

        // Update local state with the fetched trajectory
        if (response.trajectory) {
            this.state.trajectory = response.trajectory;
        }

        return response;
    }

    /**
     * Approves a command execution proposed by the AI.
     */
    async approveCommand(stepIndex: number, command: string) {
        const req = new HandleCascadeUserInteractionRequest({
            cascadeId: this.cascadeId,
            interaction: new CascadeUserInteraction({
                trajectoryId: this.cascadeId,
                stepIndex,
                interaction: {
                    case: "runCommand",
                    value: new CascadeRunCommandInteraction({
                        commandLine: command,
                    })
                }
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
