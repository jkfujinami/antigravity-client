
/**
 * test_types.ts - Unit tests for src/types.ts
 *
 * These tests run offline without any LS connection.
 * Run: npx tsx test/test_types.ts
 */

import { Step } from "../src/gen/gemini_coder_pb.js";
import { CortexStepStatus, CascadeRunStatus } from "../src/gen/exa/cortex_pb_pb.js";
import { CortexStepRunCommand, CortexStepPlannerResponse } from "../src/gen/exa/cortex_pb_pb.js";
import {
    toStepStatus,
    toRunStatus,
    getStepCategory,
    CascadeStep,
    type StepStatus,
    type RunStatus,
    type StepCategory,
} from "../src/types.js";

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

function assertEqual<T>(actual: T, expected: T, message: string) {
    if (actual === expected) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ FAIL: ${message} (expected: ${expected}, got: ${actual})`);
    }
}

// ── Test: toStepStatus ──

console.log("\n📋 toStepStatus()");

const stepStatusCases: [CortexStepStatus, StepStatus][] = [
    [CortexStepStatus.UNSPECIFIED, "unspecified"],
    [CortexStepStatus.GENERATING, "generating"],
    [CortexStepStatus.QUEUED, "queued"],
    [CortexStepStatus.PENDING, "pending"],
    [CortexStepStatus.RUNNING, "running"],
    [CortexStepStatus.WAITING, "waiting"],
    [CortexStepStatus.DONE, "done"],
    [CortexStepStatus.INVALID, "invalid"],
    [CortexStepStatus.CLEARED, "cleared"],
    [CortexStepStatus.CANCELED, "canceled"],
    [CortexStepStatus.ERROR, "error"],
    [CortexStepStatus.INTERRUPTED, "interrupted"],
];

for (const [input, expected] of stepStatusCases) {
    assertEqual(toStepStatus(input), expected, `CortexStepStatus.${CortexStepStatus[input]} -> "${expected}"`);
}

// Unknown value
assertEqual(toStepStatus(999 as CortexStepStatus), "unspecified", "Unknown CortexStepStatus -> 'unspecified'");

// ── Test: toRunStatus ──

console.log("\n📋 toRunStatus()");

const runStatusCases: [CascadeRunStatus, RunStatus][] = [
    [CascadeRunStatus.UNSPECIFIED, "unspecified"],
    [CascadeRunStatus.IDLE, "idle"],
    [CascadeRunStatus.RUNNING, "running"],
    [CascadeRunStatus.CANCELING, "canceling"],
    [CascadeRunStatus.BUSY, "busy"],
];

for (const [input, expected] of runStatusCases) {
    assertEqual(toRunStatus(input), expected, `CascadeRunStatus.${CascadeRunStatus[input]} -> "${expected}"`);
}

assertEqual(toRunStatus(999 as CascadeRunStatus), "unspecified", "Unknown CascadeRunStatus -> 'unspecified'");

// ── Test: getStepCategory ──

console.log("\n📋 getStepCategory()");

const categoryCases: [string, StepCategory][] = [
    ["userInput", "user_input"],
    ["plannerResponse", "response"],
    ["runCommand", "command"],
    ["commandStatus", "command_status"],
    ["sendCommandInput", "send_input"],
    ["viewFile", "file_view"],
    ["viewFileOutline", "file_view"],
    ["viewCodeItem", "file_view"],
    ["listDirectory", "file_view"],
    ["writeToFile", "file_write"],
    ["fileChange", "file_write"],
    ["deleteDirectory", "file_delete"],
    ["move", "file_move"],
    ["grepSearch", "search"],
    ["find", "search"],
    ["codeSearch", "search"],
    ["openBrowserUrl", "browser"],
    ["browserSubagent", "browser"],
    ["searchWeb", "web"],
    ["readUrlContent", "web"],
    ["searchKnowledgeBase", "knowledge"],
    ["systemMessage", "system"],
    ["finish", "system"],
    ["taskBoundary", "system"],
    ["dummy", "other"],
    ["generic", "other"],
    ["memory", "other"],
];

for (const [input, expected] of categoryCases) {
    assertEqual(getStepCategory(input), expected, `"${input}" -> "${expected}"`);
}

assertEqual(getStepCategory(undefined), "other", "undefined -> 'other'");
assertEqual(getStepCategory("nonExistentStep"), "other", "Unknown step case -> 'other'");

// ── Test: CascadeStep (runCommand) ──

console.log("\n📋 CascadeStep (runCommand)");

const runCmdStep = new Step({
    status: CortexStepStatus.RUNNING,
    step: {
        case: "runCommand",
        value: new CortexStepRunCommand({
            commandLine: "ls -la",
            proposedCommandLine: "ls -la",
            shouldAutoRun: false,
            cwd: "/tmp",
            stdout: "total 0\n",
            stderr: "warning: test\n",
        }),
    },
});

const wrappedRunCmd = new CascadeStep(runCmdStep, 3);

assertEqual(wrappedRunCmd.type, "runCommand", "type is 'runCommand'");
assertEqual(wrappedRunCmd.category, "command", "category is 'command'");
assertEqual(wrappedRunCmd.status, "running", "status is 'running'");
assertEqual(wrappedRunCmd.rawStatus, CortexStepStatus.RUNNING, "rawStatus is CortexStepStatus.RUNNING");
assertEqual(wrappedRunCmd.index, 3, "index is 3");
assertEqual(wrappedRunCmd.commandLine, "ls -la", "commandLine is 'ls -la'");
assertEqual(wrappedRunCmd.stdout, "total 0\n", "stdout is correct");
assertEqual(wrappedRunCmd.stderr, "warning: test\n", "stderr is correct");
assertEqual(wrappedRunCmd.description, "ls -la", "description is 'ls -la'");
assert(wrappedRunCmd.raw === runCmdStep, "raw returns the original Step");
assert(!wrappedRunCmd.hasInteraction, "no requestedInteraction");

// Planner-specific accessors should be undefined
assertEqual(wrappedRunCmd.responseText, undefined, "responseText is undefined for runCommand");
assertEqual(wrappedRunCmd.thinkingText, undefined, "thinkingText is undefined for runCommand");

// ── Test: CascadeStep (plannerResponse) ──

console.log("\n📋 CascadeStep (plannerResponse)");

const plannerStep = new Step({
    status: CortexStepStatus.DONE,
    step: {
        case: "plannerResponse",
        value: new CortexStepPlannerResponse({
            response: "Here is my response",
            thinking: "I am thinking about this",
        }),
    },
});

const wrappedPlanner = new CascadeStep(plannerStep, 7);

assertEqual(wrappedPlanner.type, "plannerResponse", "type is 'plannerResponse'");
assertEqual(wrappedPlanner.category, "response", "category is 'response'");
assertEqual(wrappedPlanner.status, "done", "status is 'done'");
assertEqual(wrappedPlanner.index, 7, "index is 7");
assertEqual(wrappedPlanner.responseText, "Here is my response", "responseText matches");
assertEqual(wrappedPlanner.thinkingText, "I am thinking about this", "thinkingText matches");
assertEqual(wrappedPlanner.description, "(AI Response)", "description is '(AI Response)'");

// Command-specific accessors should be undefined
assertEqual(wrappedPlanner.commandLine, undefined, "commandLine is undefined for plannerResponse");
assertEqual(wrappedPlanner.stdout, undefined, "stdout is undefined for plannerResponse");

// ── Test: CascadeStep (empty/unknown) ──

console.log("\n📋 CascadeStep (empty step)");

const emptyStep = new Step({
    status: CortexStepStatus.UNSPECIFIED,
});

const wrappedEmpty = new CascadeStep(emptyStep, 0);

assertEqual(wrappedEmpty.type, "unknown", "type is 'unknown' for empty step");
assertEqual(wrappedEmpty.category, "other", "category is 'other' for empty step");
assertEqual(wrappedEmpty.status, "unspecified", "status is 'unspecified'");
assertEqual(wrappedEmpty.description, "Unknown Step", "description is 'Unknown Step'");

// ── Summary ──

console.log(`\n${"═".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"═".repeat(40)}`);

if (failed > 0) {
    process.exit(1);
}
