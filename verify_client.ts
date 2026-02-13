
import { Agent } from "./src/agent/agent.js";
import { StreamTerminalShellCommandResponse, HandleCascadeUserInteractionResponse } from "./src/gen/exa/language_server_pb_pb.js";
import { Step } from "./src/gen/gemini_coder_pb.js";
import { CortexStepStatus, CortexStepRunCommand } from "./src/gen/exa/cortex_pb_pb.js";
import { EventEmitter } from "events";
import * as os from 'os';

// Configurable verification command
const VERIFY_CMD = os.platform() === 'win32' ? "echo Hello from Verification" : "echo 'Hello from Verification'";

// Mock Client for TerminalSession
const mockClient = {
    streamTerminalShellCommand: async function* (req: any) {
        console.log("Mock: streamTerminalShellCommand called");
        yield new StreamTerminalShellCommandResponse();
        try {
            for await (const chunk of req) {
                // Consume
            }
        } catch (e) {
            console.log("Mock: streamTerminalShellCommand ended or error");
        }
    },
    handleCascadeUserInteraction: async (req: any) => {
        console.log("Mock: handleCascadeUserInteraction called.");
        return new HandleCascadeUserInteractionResponse();
    }
};

// Mock Cascade
class MockCascade extends EventEmitter {
    async listen() {
        console.log("MockCascade: listen()");

        // Emit update with a step
        const step0 = new Step({
            type: 28, // runCommand
            status: CortexStepStatus.PENDING,
            step: {
                case: "runCommand",
                value: new CortexStepRunCommand({
                    commandLine: VERIFY_CMD
                })
            }
        });

        const state = {
            trajectory: {
                steps: [step0]
            }
        };

        this.emit("update", state);

        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log("MockCascade: Emitting done");
        this.emit("done");
    }
}

async function verify() {
    console.log("Starting verification...");
    console.log(`Platform: ${os.platform()}`);

    const mockCascade = new MockCascade();
    const agent = new Agent("http://mock-server", "cascade-123", "traj-123", mockClient, mockCascade);

    try {
        await agent.start();
        console.log("Verification successful (Agent loop exited)");
    } catch (e) {
        console.error("Verification failed:", e);
        process.exit(1);
    }
}

verify().catch(console.error);
