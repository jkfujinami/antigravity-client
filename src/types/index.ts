
import { Step } from "../gen/exa/gemini_coder/proto/trajectory_pb.js";
import { CortexStepStatus, CascadeRunStatus, PermissionScope } from "../gen/exa/cortex_pb/cortex_pb.js";

// ════════════════════════════════════════════════════════════════
// 1. Step status (string union)
// ════════════════════════════════════════════════════════════════
// Source enum: CortexStepStatus (src/gen/exa/cortex_pb/cortex_pb.ts)

export type StepStatus =
    | "unspecified"
    | "generating"
    | "queued"
    | "pending"
    | "running"
    | "waiting"
    | "done"
    | "invalid"
    | "cleared"
    | "canceled"
    | "error"
    | "interrupted";

export function toStepStatus(raw: CortexStepStatus): StepStatus {
    switch (raw) {
        case CortexStepStatus.UNSPECIFIED: return "unspecified";
        case CortexStepStatus.GENERATING: return "generating";
        case CortexStepStatus.QUEUED: return "queued";
        case CortexStepStatus.PENDING: return "pending";
        case CortexStepStatus.RUNNING: return "running";
        case CortexStepStatus.WAITING: return "waiting";
        case CortexStepStatus.DONE: return "done";
        case CortexStepStatus.INVALID: return "invalid";
        case CortexStepStatus.CLEARED: return "cleared";
        case CortexStepStatus.CANCELED: return "canceled";
        case CortexStepStatus.ERROR: return "error";
        case CortexStepStatus.INTERRUPTED: return "interrupted";
        default: return "unspecified";
    }
}

// ════════════════════════════════════════════════════════════════
// 2. Overall Cascade run status
// ════════════════════════════════════════════════════════════════
// Source enum: CascadeRunStatus (src/gen/exa/cortex_pb/cortex_pb.ts)

export type RunStatus = "unspecified" | "idle" | "running" | "canceling" | "busy";

export function toRunStatus(raw: CascadeRunStatus): RunStatus {
    switch (raw) {
        case CascadeRunStatus.UNSPECIFIED: return "unspecified";
        case CascadeRunStatus.IDLE: return "idle";
        case CascadeRunStatus.RUNNING: return "running";
        case CascadeRunStatus.CANCELING: return "canceling";
        case CascadeRunStatus.BUSY: return "busy";
        default: return "unspecified";
    }
}

// ════════════════════════════════════════════════════════════════
// 3. Automatic Step-type extraction
// ════════════════════════════════════════════════════════════════

/**
 * Extracts every `case` (string literal) of the oneof `step` from the Step
 * message in trajectory_pb.ts. As a result, every action the agent can
 * perform (100+ kinds) is typed automatically.
 */
export type StepType = Exclude<NonNullable<Step["step"]>["case"], undefined>;

/**
 * Resolves the payload (value) type that corresponds to a given StepType.
 */
export type StepValue<T extends StepType> = Extract<NonNullable<Step["step"]>, { case: T }>["value"];

/**
 * Step category definitions.
 */
export type StepCategory =
    | "user_input"
    | "response"
    | "command"
    | "command_status"
    | "send_input"
    | "file_view"
    | "file_write"
    | "file_delete"
    | "file_move"
    | "search"
    | "browser"
    | "web"
    | "knowledge"
    | "system"
    | "other";

/**
 * Maps every StepType to a category. Using Record<StepType, StepCategory>
 * means that whenever a new Step is added to the proto, a missing entry here
 * is surfaced as a compile error.
 */
const STEP_CATEGORY_MAP: Record<StepType, StepCategory> = {
    // --- User & Planner ---
    userInput: "user_input",
    plannerResponse: "response",
    askQuestion: "response",

    // --- Commands & Shell ---
    runCommand: "command",
    commandStatus: "command_status",
    sendCommandInput: "send_input",
    shellExec: "command",
    readTerminal: "command",
    blazeBuildTargets: "command",
    blazeTestTargets: "command",
    compile: "command",
    compileApplet: "command",
    restartDevServer: "command",

    // --- File Operations ---
    viewFile: "file_view",
    viewFileOutline: "file_view",
    viewCodeItem: "file_view",
    listDirectory: "file_view",
    viewContentChunk: "file_view",
    readNotebook: "file_view",
    writeToFile: "file_write",
    writeBlob: "file_write",
    fileChange: "file_write",
    proposeCode: "file_write",
    fileBreakdown: "file_write",
    codeAction: "file_write",
    codeAcknowledgement: "file_write",
    editNotebook: "file_write",
    executeNotebook: "file_write",
    deleteDirectory: "file_delete",
    move: "file_move",

    // --- Browser ---
    openBrowserUrl: "browser",
    readBrowserPage: "browser",
    captureBrowserScreenshot: "browser",
    clickBrowserPixel: "browser",
    executeBrowserJavascript: "browser",
    listBrowserPages: "browser",
    browserGetDom: "browser",
    browserInput: "browser",
    browserMoveMouse: "browser",
    browserSelectOption: "browser",
    browserScrollUp: "browser",
    browserScrollDown: "browser",
    browserScroll: "browser",
    browserClickElement: "browser",
    browserPressKey: "browser",
    browserSubagent: "browser",
    browserResizeWindow: "browser",
    browserDragPixelToPixel: "browser",
    browserMouseWheel: "browser",
    browserMouseUp: "browser",
    browserMouseDown: "browser",
    browserRefreshPage: "browser",
    browserListNetworkRequests: "browser",
    browserGetNetworkRequest: "browser",
    captureBrowserConsoleLogs: "browser",

    // --- Search & Knowledge ---
    grepSearch: "search",
    find: "search",
    codeSearch: "search",
    internalSearch: "search",
    trajectorySearch: "search",
    findAllReferences: "search",
    retrieveContent: "search",
    searchWeb: "web",
    readUrlContent: "web",
    searchKnowledgeBase: "knowledge",
    lookupKnowledgeBase: "knowledge",
    knowledgeGeneration: "knowledge",
    knowledgeArtifacts: "knowledge",
    directoryRules: "knowledge",

    // --- System & Meta ---
    systemMessage: "system",
    ephemeralMessage: "system",
    errorMessage: "system",
    finish: "system",
    checkpoint: "system",
    taskBoundary: "system",
    notifyUser: "system",
    suggestedResponses: "system",
    lintDiff: "system",
    gitCommit: "system",
    generateImage: "system",
    mcpTool: "system",
    listResources: "system",
    readResource: "system",
    clipboard: "system",
    wait: "system",
    critique: "system",
    findings: "system",

    // --- Other / To be categorized ---
    dummy: "other",
    generic: "other",
    planInput: "other",
    mquery: "other",
    memory: "other",
    retrieveMemory: "other",
    managerFeedback: "other",
    toolCallProposal: "other",
    toolCallChoice: "other",
    toolSearch: "other",
    trajectoryChoice: "other",
    brainUpdate: "other",
    proposalFeedback: "other",
    conversationHistory: "other",
    kiInsertion: "other",
    agencyToolCall: "other",
    invokeSubagent: "other",
    runExtensionCode: "other",
    workspaceApi: "other",
    installAppletDependencies: "other",
    installAppletPackage: "other",
    setUpFirebase: "other",
    deployFirebase: "other",
    lintApplet: "other",
    checkDeployStatus: "other",
    postPrReview: "other",
    buildCleaner: "other",
    cloudsqlExecuteSql: "other",
    cloudsqlUpdateSchema: "other",
    moma: "other",
    rpcAction: "other",
    setUpCloudsql: "other",
};

/** Look up the category for a step case. */
export function getStepCategory(stepCase: StepType | undefined): StepCategory {
    if (!stepCase) return "other";
    return (STEP_CATEGORY_MAP as any)[stepCase] ?? "other";
}

// ════════════════════════════════════════════════════════════════
// 4. CascadeStep (wrapper around a raw Step)
// ════════════════════════════════════════════════════════════════

export class CascadeStep {
    constructor(
        private readonly _raw: Step,
        public readonly index: number
    ) {}

    /** Access the underlying Protobuf Step (for debugging / advanced use). */
    get raw(): Step { return this._raw; }

    /** The step's oneof case name (e.g. "runCommand", "plannerResponse"). */
    get type(): StepType | "unknown" {
        return (this._raw.step?.case as StepType) ?? "unknown";
    }

    /**
     * Narrows the step to a specific StepType.
     * Usage: if (step.is("runCommand")) { console.log(step.value.commandLine); }
     */
    is<T extends StepType>(type: T): this is CascadeStep & { type: T, value: StepValue<T> } {
        return this._raw.step?.case === type;
    }

    /** The step's category. */
    get category(): StepCategory {
        return getStepCategory(this._raw.step?.case as StepType);
    }

    /** Status as the SDK string union. */
    get status(): StepStatus {
        return toStepStatus(this._raw.status);
    }

    /** Status as the raw numeric enum. */
    get rawStatus(): CortexStepStatus {
        return this._raw.status;
    }

    /** Low-level access to the oneof value. */
    get value(): any {
        return this._raw.step?.value;
    }

    /** Whether a RequestedInteraction is present. */
    get hasInteraction(): boolean {
        return !!this._raw.requestedInteraction?.interaction?.case;
    }

    /** Builds a human-readable description of the step. */
    get description(): string {
        const step = this._raw;
        if (!step.step?.case) return "Unknown Step";

        switch (step.step.case) {
            case "runCommand": {
                const v = step.step.value;
                return v.commandLine || v.proposedCommandLine || "(no command)";
            }
            case "writeToFile": {
                const v = step.step.value as any;
                if (v.encodedFiles?.length > 0) {
                    return v.encodedFiles.map((f: any) => f.filePath).join(", ");
                }
                return "(file write)";
            }
            case "viewFile":
                return (step.step.value as any).filePath || "(file)";
            case "plannerResponse":
                return "(AI Response)";
            case "userInput":
                return "(User Input)";
            default:
                return step.step.case;
        }
    }

    // ── Convenience accessors ──

    /** Command line of a runCommand step. */
    get commandLine(): string | undefined {
        if (!this.is("runCommand")) return undefined;
        return this.value.proposedCommandLine || this.value.commandLine || undefined;
    }

    /** stdout of a runCommand step. */
    get stdout(): string | undefined {
        if (!this.is("runCommand")) return undefined;
        return this.value.stdout || undefined;
    }

    /** stderr of a runCommand step. */
    get stderr(): string | undefined {
        if (!this.is("runCommand")) return undefined;
        return this.value.stderr || undefined;
    }

    /** Response text of a plannerResponse step. */
    get responseText(): string | undefined {
        if (!this.is("plannerResponse")) return undefined;
        return this.value.response || undefined;
    }

    /** Thinking text of a plannerResponse step. */
    get thinkingText(): string | undefined {
        if (!this.is("plannerResponse")) return undefined;
        return this.value.thinking || undefined;
    }
}

// ════════════════════════════════════════════════════════════════
// 5. Event payload type definitions
// ════════════════════════════════════════════════════════════════

export interface TextDeltaEvent { delta: string; fullText: string; stepIndex: number; }
export interface ThinkingDeltaEvent { delta: string; fullText: string; stepIndex: number; }
export interface CommandOutputEvent { delta: string; fullText: string; stream: "stdout" | "stderr"; stepIndex: number; }
export interface StepNewEvent { step: CascadeStep; }
export interface StepUpdateEvent { step: CascadeStep; previousStatus: StepStatus; }
export interface StatusChangeEvent { status: RunStatus; previousStatus: RunStatus; }

// ════════════════════════════════════════════════════════════════
// 6. ApprovalRequest (approval request object)
// ════════════════════════════════════════════════════════════════

export type ApprovalType =
    | "run_command"
    | "file_permission"
    | "open_browser_url"
    | "browser_action"
    | "send_command_input"
    | "mcp"
    | "other";

export interface ApprovalRequest {
    readonly type: ApprovalType;
    readonly description: string;
    readonly stepIndex: number;
    readonly step: CascadeStep;
    readonly autoRun: boolean;
    readonly needsApproval: boolean;
    readonly commandLine?: string;
    readonly filePath?: string;
    readonly isDirectory?: boolean;
    readonly url?: string;
    approve(scope?: "once" | "conversation"): Promise<void>;
    deny(): Promise<void>;
}

// ════════════════════════════════════════════════════════════════
// 7. Event name -> payload type mapping
// ════════════════════════════════════════════════════════════════

export { CascadeEvents, type CascadeEventPayloads } from "./events.js";

// ════════════════════════════════════════════════════════════════
// 8. PermissionScope re-export
// ════════════════════════════════════════════════════════════════

export { PermissionScope } from "../gen/exa/cortex_pb/cortex_pb.js";

// ════════════════════════════════════════════════════════════════
// 9. Known model-name constants
// ════════════════════════════════════════════════════════════════

/**
 * Known model names matching the keys of `client.getAvailableModels()`.
 * Numeric model IDs change often across LS updates, so only the label names
 * are pinned here; the actual numeric ID is resolved on demand via
 * `client.resolveModelId(name)`.
 */
export const MODEL_NAMES = {
    GEMINI_3_FLASH: "Gemini_3_Flash",
    GEMINI_3_1_PRO_HIGH: "Gemini_3.1_Pro_High",
    GEMINI_3_1_PRO_LOW: "Gemini_3.1_Pro_Low",
    CLAUDE_SONNET_4_6_THINKING: "Claude_Sonnet_4.6_Thinking",
    CLAUDE_OPUS_4_6_THINKING: "Claude_Opus_4.6_Thinking",
    GPT_OSS_120B_MEDIUM: "GPT-OSS_120B_Medium",
} as const;

export type ModelName = typeof MODEL_NAMES[keyof typeof MODEL_NAMES];

// ════════════════════════════════════════════════════════════════
// 10. RunResult (return value of cascade.run)
// ════════════════════════════════════════════════════════════════

export interface RunResult {
    /** Full text emitted by the model during this turn (accumulated). */
    text: string;
    /** Steps newly added during this turn (wrapped as CascadeStep). */
    newSteps: CascadeStep[];
    /** Status when the turn completed. Usually "idle"; "canceling"/"idle" after cancel. */
    finalStatus: RunStatus;
    /** True if the task exceeded timeoutMs. */
    timedOut: boolean;
}
