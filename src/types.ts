
import { Step } from "./gen/gemini_coder_pb.js";
import { CortexStepStatus, CascadeRunStatus, PermissionScope } from "./gen/exa/cortex_pb_pb.js";

// ════════════════════════════════════════════════════════════════
// 1. ステップのステータス (文字列型)
// ════════════════════════════════════════════════════════════════
// 元の enum: CortexStepStatus (src/gen/exa/cortex_pb_pb.ts L579-639)

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
// 2. Cascade 全体のステータス
// ════════════════════════════════════════════════════════════════
// 元の enum: CascadeRunStatus (src/gen/exa/cortex_pb_pb.ts L659-684)

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
// 3. ステップ種別カテゴリ
// ════════════════════════════════════════════════════════════════
// Step.step の oneof case (src/gen/gemini_coder_pb.ts L266-878) を分類

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

const STEP_CATEGORY_MAP: Record<string, StepCategory> = {
    userInput: "user_input",
    plannerResponse: "response",
    runCommand: "command",
    commandStatus: "command_status",
    sendCommandInput: "send_input",
    shellExec: "command",
    readTerminal: "command",
    viewFile: "file_view",
    viewFileOutline: "file_view",
    viewCodeItem: "file_view",
    listDirectory: "file_view",
    viewContentChunk: "file_view",
    writeToFile: "file_write",
    fileChange: "file_write",
    proposeCode: "file_write",
    fileBreakdown: "file_write",
    codeAction: "file_write",
    codeAcknowledgement: "file_write",
    deleteDirectory: "file_delete",
    move: "file_move",
    grepSearch: "search",
    find: "search",
    codeSearch: "search",
    internalSearch: "search",
    trajectorySearch: "search",
    findAllReferences: "search",
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
    searchWeb: "web",
    readUrlContent: "web",
    searchKnowledgeBase: "knowledge",
    lookupKnowledgeBase: "knowledge",
    knowledgeGeneration: "knowledge",
    knowledgeArtifacts: "knowledge",
    systemMessage: "system",
    ephemeralMessage: "system",
    errorMessage: "system",
    finish: "system",
    checkpoint: "system",
    taskBoundary: "system",
    notifyUser: "system",
    suggestedResponses: "system",
    lintDiff: "system",
    compile: "system",
    gitCommit: "system",
    generateImage: "system",
    mcpTool: "system",
    listResources: "system",
    readResource: "system",
    clipboard: "system",
    wait: "system",
    dummy: "other",
    generic: "other",
    planInput: "other",
    mquery: "other",
    memory: "other",
    retrieveMemory: "other",
    managerFeedback: "other",
    toolCallProposal: "other",
    toolCallChoice: "other",
    trajectoryChoice: "other",
    brainUpdate: "other",
    addAnnotation: "other",
    proposalFeedback: "other",
    conversationHistory: "other",
    kiInsertion: "other",
    agencyToolCall: "other",
    runExtensionCode: "other",
    workspaceApi: "other",
    compileApplet: "other",
    installAppletDependencies: "other",
    installAppletPackage: "other",
    setUpFirebase: "other",
    restartDevServer: "other",
    deployFirebase: "other",
    lintApplet: "other",
    defineNewEnvVariable: "other",
    checkDeployStatus: "other",
    postPrReview: "other",
};

/** カテゴリマップへのアクセス (テスト用にもエクスポート) */
export function getStepCategory(stepCase: string | undefined): StepCategory {
    if (!stepCase) return "other";
    return STEP_CATEGORY_MAP[stepCase] ?? "other";
}

// ════════════════════════════════════════════════════════════════
// 4. CascadeStep (Step のラッパークラス)
// ════════════════════════════════════════════════════════════════

export class CascadeStep {
    constructor(
        private readonly _raw: Step,
        public readonly index: number
    ) {}

    /** 元の Protobuf Step へのアクセス (デバッグ・高度な利用向け) */
    get raw(): Step { return this._raw; }

    /** ステップの oneof case 名 (例: "runCommand", "plannerResponse") */
    get type(): string {
        return this._raw.step?.case ?? "unknown";
    }

    /** ステップのカテゴリ */
    get category(): StepCategory {
        return getStepCategory(this._raw.step?.case);
    }

    /** ステータス (SDK 文字列型) */
    get status(): StepStatus {
        return toStepStatus(this._raw.status);
    }

    /** ステータス (元の数値 enum) */
    get rawStatus(): CortexStepStatus {
        return this._raw.status;
    }

    /** oneof の value への低レベルアクセス */
    get value(): unknown {
        return this._raw.step?.value;
    }

    /** RequestedInteraction が存在するか */
    get hasInteraction(): boolean {
        return !!this._raw.requestedInteraction?.interaction?.case;
    }

    /** ステップの説明文を生成 */
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

    /** runCommand ステップのコマンドライン */
    get commandLine(): string | undefined {
        if (this._raw.step?.case !== "runCommand") return undefined;
        const v = this._raw.step.value;
        return v.proposedCommandLine || v.commandLine || undefined;
    }

    /** runCommand ステップの stdout */
    get stdout(): string | undefined {
        if (this._raw.step?.case !== "runCommand") return undefined;
        return this._raw.step.value.stdout || undefined;
    }

    /** runCommand ステップの stderr */
    get stderr(): string | undefined {
        if (this._raw.step?.case !== "runCommand") return undefined;
        return this._raw.step.value.stderr || undefined;
    }

    /** plannerResponse ステップのレスポンステキスト */
    get responseText(): string | undefined {
        if (this._raw.step?.case !== "plannerResponse") return undefined;
        return this._raw.step.value.response || undefined;
    }

    /** plannerResponse ステップの思考テキスト */
    get thinkingText(): string | undefined {
        if (this._raw.step?.case !== "plannerResponse") return undefined;
        return this._raw.step.value.thinking || undefined;
    }
}

// ════════════════════════════════════════════════════════════════
// 5. ApprovalRequest (承認リクエストオブジェクト)
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
// 6. 高レベルイベント型定義
// ════════════════════════════════════════════════════════════════

export interface StepNewEvent {
    step: CascadeStep;
}

export interface StepUpdateEvent {
    step: CascadeStep;
    previousStatus: StepStatus;
}

export interface TextDeltaEvent {
    delta: string;
    fullText: string;
    stepIndex: number;
}

export interface ThinkingDeltaEvent {
    delta: string;
    fullText: string;
    stepIndex: number;
}

export interface CommandOutputEvent {
    delta: string;
    fullText: string;
    stream: "stdout" | "stderr";
    stepIndex: number;
}

export interface StatusChangeEvent {
    status: RunStatus;
    previousStatus: RunStatus;
}

// ════════════════════════════════════════════════════════════════
// 7. PermissionScope の再エクスポート (repl.ts が直接 gen/ を参照しなくて済むように)
// ════════════════════════════════════════════════════════════════

export { PermissionScope } from "./gen/exa/cortex_pb_pb.js";
