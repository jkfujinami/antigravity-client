import type { PromiseClient } from "@connectrpc/connect";
import { LanguageServerService } from "../../gen/exa/language_server_pb/language_server_connect.js";
import { StreamReactiveUpdatesRequest } from "../../gen/exa/reactive_component_pb/reactive_component_pb.js";
import { CascadeState } from "../../gen/exa/jetski_cortex_pb/jetski_cortex_pb.js";
import { Trajectory } from "../../gen/exa/gemini_coder/proto/trajectory_pb.js";

export class CascadeStreamHandler {
    private abortController: AbortController | null = null;
    public isListening = false;

    constructor(
        private cascadeId: string,
        private lsClient: PromiseClient<typeof LanguageServerService>,
        private apiKey: string,
        private onUpdate: (state: CascadeState) => void,
        private onError: (error: any) => void,
        private onDone: () => void
    ) {}

    async listen() {
        if (this.isListening) return;
        this.isListening = true;
        this.abortController = new AbortController();

        const retryDelay = 1000;
        let currentState = new CascadeState();

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
                        currentState.status = update.status as any;
                    }

                    // 2. Sync Trajectory Steps (Manual Hydration)
                    const mainTraj = update.mainTrajectoryUpdate;
                    if (mainTraj?.stepsUpdate) {
                        if (!currentState.trajectory) {
                            currentState.trajectory = new Trajectory();
                        }
                        // Important: Sync trajectoryId from update to allow correct interactions
                        if (update.trajectoryId) {
                            currentState.trajectory.trajectoryId = update.trajectoryId;
                        }
                        const { steps, indices } = mainTraj.stepsUpdate;
                        indices.forEach((idx: number, i: number) => {
                            currentState.trajectory!.steps[idx] = steps[i];
                        });
                    }

                    // 3. Emit internal events for deltas and interactions
                    this.onUpdate(currentState);
                }
            } catch (err: any) {
                // If we were explicitly disposed, ignore connection errors and exit immediately
                if (!this.isListening) {
                    break;
                }
                if (err?.code === 1 || (err?.code === 2 && err?.message?.includes("canceled"))) {
                    break;
                }
                this.onError(err);
            }

            if (!this.isListening) break;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

        this.isListening = false;
    }

    dispose() {
        this.isListening = false;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }
}
