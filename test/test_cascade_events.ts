
/**
 * test_cascade_events.ts - Integration test for high-level cascade events
 *
 * Requires the Antigravity Language Server to be running.
 * Run: npx tsx test/test_cascade_events.ts
 */

import { AntigravityClient } from "../src/client.js";
import { Cascade } from "../src/cascade.js";
import type {
    CascadeStep,
    StepNewEvent,
    StepUpdateEvent,
    TextDeltaEvent,
    ThinkingDeltaEvent,
    CommandOutputEvent,
    StatusChangeEvent,
    ApprovalRequest,
} from "../src/types.js";

async function main() {
    console.log("🔌 Connecting to Language Server...");

    let client: AntigravityClient;
    try {
        client = await AntigravityClient.connect({ autoDetect: true });
        console.log("✅ Connected.\n");
    } catch (e) {
        console.log("⚠️  Language Server not found. Skipping integration test.");
        console.log("   (Start Antigravity IDE to run this test)");
        process.exit(0);
    }

    console.log("🚀 Starting new cascade...");
    const cascade = await client.startCascade();
    console.log(`✨ Cascade ID: ${cascade.cascadeId}\n`);

    // ── Track which events fire ──

    const received = {
        stepNew: [] as StepNewEvent[],
        stepUpdate: [] as StepUpdateEvent[],
        textDelta: [] as TextDeltaEvent[],
        thinkingDelta: [] as ThinkingDeltaEvent[],
        statusChange: [] as StatusChangeEvent[],
        approvalNeeded: [] as ApprovalRequest[],
        // Legacy events
        legacyText: 0,
        legacyThinking: 0,
        legacyInteraction: 0,
        legacyDone: 0,
    };

    // New events
    cascade.on("step:new", (ev: StepNewEvent) => {
        received.stepNew.push(ev);
        console.log(`  [step:new] Step ${ev.step.index}: ${ev.step.type} (${ev.step.status}) - ${ev.step.description}`);
        console.log(`    category: ${ev.step.category}`);
    });

    cascade.on("step:update", (ev: StepUpdateEvent) => {
        received.stepUpdate.push(ev);
        console.log(`  [step:update] Step ${ev.step.index}: ${ev.previousStatus} -> ${ev.step.status}`);
    });

    cascade.on("text:delta", (ev: TextDeltaEvent) => {
        received.textDelta.push(ev);
        // Don't print individual deltas to reduce noise, just accumulate
    });

    cascade.on("thinking:delta", (ev: ThinkingDeltaEvent) => {
        received.thinkingDelta.push(ev);
    });

    cascade.on("status_change", (ev: StatusChangeEvent) => {
        received.statusChange.push(ev);
        console.log(`  [status_change] ${ev.previousStatus} -> ${ev.status}`);
    });

    cascade.on("approval:needed", (ev: ApprovalRequest) => {
        received.approvalNeeded.push(ev);
        console.log(`  [approval:needed] ${ev.type}: ${ev.description} (needsApproval: ${ev.needsApproval})`);
        console.log(`    .approve is function: ${typeof ev.approve === 'function'}`);
        console.log(`    .deny is function: ${typeof ev.deny === 'function'}`);
        console.log(`    .step.type: ${ev.step.type}`);
        console.log(`    .step.category: ${ev.step.category}`);
    });

    // Legacy events
    cascade.on("text", () => { received.legacyText++; });
    cascade.on("thinking", () => { received.legacyThinking++; });
    cascade.on("interaction", () => { received.legacyInteraction++; });
    cascade.on("done", () => { received.legacyDone++; });

    // ── Send a simple message ──

    console.log("📨 Sending message: 'Say hello in Japanese'...\n");
    await cascade.sendMessage("日本語で「こんにちは」とだけ返答してください。それ以外は何も言わないで。");

    // Wait for response
    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            console.log("\n⏰ Timeout reached (30s).");
            resolve();
        }, 30000);

        cascade.on("done", () => {
            clearTimeout(timeout);
            // Give a short delay for any final events
            setTimeout(resolve, 1000);
        });
    });

    // ── Report ──

    console.log("\n" + "═".repeat(50));
    console.log("📊 Event Report");
    console.log("═".repeat(50));

    console.log("\n--- New High-Level Events ---");
    console.log(`  step:new        : ${received.stepNew.length} events`);
    console.log(`  step:update     : ${received.stepUpdate.length} events`);
    console.log(`  text:delta      : ${received.textDelta.length} events`);
    console.log(`  thinking:delta  : ${received.thinkingDelta.length} events`);
    console.log(`  status_change   : ${received.statusChange.length} events`);
    console.log(`  approval:needed : ${received.approvalNeeded.length} events`);

    console.log("\n--- Legacy Events (compatibility) ---");
    console.log(`  text            : ${received.legacyText} events`);
    console.log(`  thinking        : ${received.legacyThinking} events`);
    console.log(`  interaction     : ${received.legacyInteraction} events`);
    console.log(`  done            : ${received.legacyDone} events`);

    // ── Assertions ──

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, message: string) {
        if (condition) {
            passed++;
            console.log(`  ✅ ${message}`);
        } else {
            failed++;
            console.error(`  ❌ FAIL: ${message}`);
        }
    }

    console.log("\n--- Assertions ---");

    assert(received.stepNew.length > 0, "step:new events were fired");
    assert(received.statusChange.length > 0, "status_change events were fired");

    // Check that new text:delta events match legacy text events
    assert(received.textDelta.length === received.legacyText,
        `text:delta count (${received.textDelta.length}) matches legacy text count (${received.legacyText})`);
    assert(received.thinkingDelta.length === received.legacyThinking,
        `thinking:delta count (${received.thinkingDelta.length}) matches legacy thinking count (${received.legacyThinking})`);

    // Check CascadeStep properties on step:new events
    if (received.stepNew.length > 0) {
        const firstStep = received.stepNew[0].step;
        assert(typeof firstStep.type === "string", "step.type is a string");
        assert(typeof firstStep.category === "string", "step.category is a string");
        assert(typeof firstStep.status === "string", "step.status is a string");
        assert(typeof firstStep.description === "string", "step.description is a string");
        assert(typeof firstStep.index === "number", "step.index is a number");
        assert(firstStep.raw !== null && firstStep.raw !== undefined, "step.raw is accessible");
    }

    // Check approval:needed has correct structure
    if (received.approvalNeeded.length > 0) {
        const req = received.approvalNeeded[0];
        assert(typeof req.approve === "function", "ApprovalRequest.approve is a function");
        assert(typeof req.deny === "function", "ApprovalRequest.deny is a function");
        assert(typeof req.type === "string", "ApprovalRequest.type is a string");
        assert(typeof req.description === "string", "ApprovalRequest.description is a string");
        assert(typeof req.needsApproval === "boolean", "ApprovalRequest.needsApproval is a boolean");
        assert(req.step !== undefined, "ApprovalRequest.step is a CascadeStep");

        // Verify legacy interaction event also fired for the same
        assert(received.legacyInteraction === received.approvalNeeded.length,
            `approval:needed count matches legacy interaction count`);
    }

    // Check text:delta event structure
    if (received.textDelta.length > 0) {
        const ev = received.textDelta[0];
        assert(typeof ev.delta === "string" && ev.delta.length > 0, "TextDeltaEvent.delta is a non-empty string");
        assert(typeof ev.fullText === "string", "TextDeltaEvent.fullText is a string");
        assert(typeof ev.stepIndex === "number", "TextDeltaEvent.stepIndex is a number");
    }

    // Check status_change event structure
    if (received.statusChange.length > 0) {
        const ev = received.statusChange[0];
        assert(typeof ev.status === "string", "StatusChangeEvent.status is a string");
        assert(typeof ev.previousStatus === "string", "StatusChangeEvent.previousStatus is a string");
    }

    console.log(`\n${"═".repeat(50)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`${"═".repeat(50)}`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error("❌ Test Error:", e);
    process.exit(1);
});
