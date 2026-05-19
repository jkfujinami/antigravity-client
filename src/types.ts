
import { Step } from "./gen/exa/gemini_coder/proto/trajectory_pb.js";
import { CortexStepStatus, CascadeRunStatus, PermissionScope } from "./gen/exa/cortex_pb/cortex_pb.js";

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
// 3. Step 型の自動抽出
// ════════════════════════════════════════════════════════════════

/**
 * trajectory.pb.ts の Step メッセージから oneof 'step' のすべてのケース (文字列リリテラル) を抽出します。
 * これにより、エージェントが実行可能な全アクション（100種類以上）が自動的に型定義されます。
 */
export type StepType = Exclude<NonNullable<Step["step"]>["case"], undefined>;

/**
 * 特定の StepType に対応するペイロード (value) の型を取得します。
 */
export type StepValue<T extends StepType> = Extract<NonNullable<Step["step"]>, { case: T }>["value"];

/** 
 * Step カテゴリの定義 
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
 * すべての StepType をカテゴリに分類するマップ。
 * Record<StepType, StepCategory> を使うことで、Proto に新しい Step が追加された際に
 * ここへの登録漏れがコンパイルエラーとして検出されます。
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

/** カテゴリマップへのアクセス */
export function getStepCategory(stepCase: StepType | undefined): StepCategory {
    if (!stepCase) return "other";
    return (STEP_CATEGORY_MAP as any)[stepCase] ?? "other";
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
    get type(): StepType | "unknown" {
        return (this._raw.step?.case as StepType) ?? "unknown";
    }

    /** 
     * 指定した StepType かどうかを判定し、型を絞り込みます。
     * if (step.is("runCommand")) { console.log(step.value.commandLine); } のように使います。
     */
    is<T extends StepType>(type: T): this is CascadeStep & { type: T, value: StepValue<T> } {
        return this._raw.step?.case === type;
    }

    /** ステップのカテゴリ */
    get category(): StepCategory {
        return getStepCategory(this._raw.step?.case as StepType);
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
    get value(): any {
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
        if (!this.is("runCommand")) return undefined;
        return this.value.proposedCommandLine || this.value.commandLine || undefined;
    }

    /** runCommand ステップの stdout */
    get stdout(): string | undefined {
        if (!this.is("runCommand")) return undefined;
        return this.value.stdout || undefined;
    }

    /** runCommand ステップの stderr */
    get stderr(): string | undefined {
        if (!this.is("runCommand")) return undefined;
        return this.value.stderr || undefined;
    }

    /** plannerResponse ステップのレスポンステキスト */
    get responseText(): string | undefined {
        if (!this.is("plannerResponse")) return undefined;
        return this.value.response || undefined;
    }

    /** plannerResponse ステップの思考テキスト */
    get thinkingText(): string | undefined {
        if (!this.is("plannerResponse")) return undefined;
        return this.value.thinking || undefined;
    }
}

// ════════════════════════════════════════════════════════════════
// 5. イベントペイロードの型定義
// ════════════════════════════════════════════════════════════════

export interface TextDeltaEvent { delta: string; fullText: string; stepIndex: number; }
export interface ThinkingDeltaEvent { delta: string; fullText: string; stepIndex: number; }
export interface CommandOutputEvent { delta: string; fullText: string; stream: "stdout" | "stderr"; stepIndex: number; }
export interface StepNewEvent { step: CascadeStep; }
export interface StepUpdateEvent { step: CascadeStep; previousStatus: StepStatus; }
export interface StatusChangeEvent { status: RunStatus; previousStatus: RunStatus; }

// ════════════════════════════════════════════════════════════════
// 6. ApprovalRequest (承認リクエストオブジェクト)
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
// 7. イベント名とペイロードの型マッピング
// ════════════════════════════════════════════════════════════════

export { CascadeEvents, type CascadeEventPayloads } from "./event-types.js";

// ════════════════════════════════════════════════════════════════
// 8. PermissionScope の再エクスポート
// ════════════════════════════════════════════════════════════════

export { PermissionScope } from "./gen/exa/cortex_pb/cortex_pb.js";
