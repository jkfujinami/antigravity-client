/**
 * schema_diff.ts — FileDescriptorProto ベースの構造的 diff + SDK 影響分析
 */

import { FileDescriptorProto } from "@bufbuild/protobuf";

// ═══════════════════════════════════════════════════════════════
// 型定義
// ═══════════════════════════════════════════════════════════════

interface FieldInfo { no: number; name: string; type: number; typeName: string; label: number; oneof?: string; }
interface MsgInfo { fullName: string; fields: Map<number, FieldInfo>; }
interface EnumValueInfo { name: string; no: number; }
interface EnumInfo { fullName: string; values: Map<number, EnumValueInfo>; }
interface MethodInfo { name: string; input: string; output: string; serverStreaming: boolean; }
interface SvcInfo { fullName: string; methods: Map<string, MethodInfo>; }

interface FieldChange { fieldNo: number; changes: string[]; }
interface MsgChange { fullName: string; addedFields: FieldInfo[]; removedFields: FieldInfo[]; changedFields: FieldChange[]; }
interface EnumChange { fullName: string; addedValues: EnumValueInfo[]; removedValues: EnumValueInfo[]; }
interface SvcChange { fullName: string; addedMethods: MethodInfo[]; removedMethods: MethodInfo[]; changedMethods: { name: string; changes: string[] }[]; }

export interface DiffResult {
    addedMessages: string[]; removedMessages: string[]; changedMessages: MsgChange[];
    addedEnums: string[]; removedEnums: string[]; changedEnums: EnumChange[];
    addedServices: string[]; removedServices: string[]; changedServices: SvcChange[];
}

export interface ImpactItem {
    severity: "🔴 HIGH" | "🟡 MEDIUM" | "🟢 LOW";
    message: string;
    file: string;
    action: string;
}

// ═══════════════════════════════════════════════════════════════
// ディスクリプタ → フラットなスキーマ収集
// ═══════════════════════════════════════════════════════════════

function collectSchema(descriptors: Map<string, InstanceType<typeof FileDescriptorProto>>) {
    const messages = new Map<string, MsgInfo>();
    const enums = new Map<string, EnumInfo>();
    const services = new Map<string, SvcInfo>();

    for (const [, desc] of descriptors) {
        const pkg = desc.package || "";
        collectMessages(desc.messageType as any[], pkg, messages, enums);
        collectEnums(desc.enumType as any[], pkg, enums);
        for (const s of (desc.service || []) as any[]) {
            const fullName = pkg ? `${pkg}.${s.name}` : s.name;
            const methods = new Map<string, MethodInfo>();
            for (const m of (s.method || [])) {
                methods.set(m.name, {
                    name: m.name,
                    input: fqn(m.inputType),
                    output: fqn(m.outputType),
                    serverStreaming: !!m.serverStreaming,
                });
            }
            services.set(fullName, { fullName, methods });
        }
    }
    return { messages, enums, services };
}

function collectMessages(msgs: any[], prefix: string, msgsOut: Map<string, MsgInfo>, enumsOut: Map<string, EnumInfo>) {
    if (!msgs) return;
    for (const m of msgs) {
        const fullName = prefix ? `${prefix}.${m.name}` : m.name;
        const fields = new Map<number, FieldInfo>();
        const oneofDecls: string[] = (m.oneofDecl || []).map((o: any) => o.name);
        for (const f of (m.field || [])) {
            const hasOneof = f.oneofIndex !== undefined && f.oneofIndex !== null && !f.proto3Optional;
            fields.set(f.number, {
                no: f.number, name: f.name, type: f.type,
                typeName: fqn(f.typeName), label: f.label,
                oneof: hasOneof ? oneofDecls[f.oneofIndex] : undefined,
            });
        }
        msgsOut.set(fullName, { fullName, fields });
        if (m.nestedType) collectMessages(m.nestedType, fullName, msgsOut, enumsOut);
        if (m.enumType) collectEnums(m.enumType, fullName, enumsOut);
    }
}

function collectEnums(enums: any[], prefix: string, out: Map<string, EnumInfo>) {
    if (!enums) return;
    for (const e of enums) {
        const fullName = prefix ? `${prefix}.${e.name}` : e.name;
        const values = new Map<number, EnumValueInfo>();
        for (const v of (e.value || [])) {
            values.set(v.number, { name: v.name, no: v.number });
        }
        out.set(fullName, { fullName, values });
    }
}

function fqn(t: string | undefined): string {
    if (!t) return "";
    return t.startsWith(".") ? t.substring(1) : t;
}

// ═══════════════════════════════════════════════════════════════
// 差分計算
// ═══════════════════════════════════════════════════════════════

export function computeDiff(
    oldDescs: Map<string, InstanceType<typeof FileDescriptorProto>>,
    newDescs: Map<string, InstanceType<typeof FileDescriptorProto>>,
): DiffResult {
    const oldS = collectSchema(oldDescs);
    const newS = collectSchema(newDescs);

    const result: DiffResult = {
        addedMessages: [], removedMessages: [], changedMessages: [],
        addedEnums: [], removedEnums: [], changedEnums: [],
        addedServices: [], removedServices: [], changedServices: [],
    };

    // Messages
    for (const name of newS.messages.keys()) {
        if (!oldS.messages.has(name)) result.addedMessages.push(name);
    }
    for (const name of oldS.messages.keys()) {
        if (!newS.messages.has(name)) result.removedMessages.push(name);
    }
    for (const [name, newMsg] of newS.messages) {
        const oldMsg = oldS.messages.get(name);
        if (!oldMsg) continue;
        const change = diffMsg(oldMsg, newMsg);
        if (change) result.changedMessages.push(change);
    }

    // Enums
    for (const name of newS.enums.keys()) {
        if (!oldS.enums.has(name)) result.addedEnums.push(name);
    }
    for (const name of oldS.enums.keys()) {
        if (!newS.enums.has(name)) result.removedEnums.push(name);
    }
    for (const [name, newE] of newS.enums) {
        const oldE = oldS.enums.get(name);
        if (!oldE) continue;
        const added = [...newE.values.values()].filter(v => !oldE.values.has(v.no));
        const removed = [...oldE.values.values()].filter(v => !newE.values.has(v.no));
        if (added.length || removed.length) result.changedEnums.push({ fullName: name, addedValues: added, removedValues: removed });
    }

    // Services
    for (const name of newS.services.keys()) {
        if (!oldS.services.has(name)) result.addedServices.push(name);
    }
    for (const name of oldS.services.keys()) {
        if (!newS.services.has(name)) result.removedServices.push(name);
    }
    for (const [name, newSvc] of newS.services) {
        const oldSvc = oldS.services.get(name);
        if (!oldSvc) continue;
        const change = diffSvc(oldSvc, newSvc);
        if (change) result.changedServices.push(change);
    }

    return result;
}

function diffMsg(oldMsg: MsgInfo, newMsg: MsgInfo): MsgChange | null {
    const added = [...newMsg.fields.values()].filter(f => !oldMsg.fields.has(f.no));
    const removed = [...oldMsg.fields.values()].filter(f => !newMsg.fields.has(f.no));
    const changed: FieldChange[] = [];
    for (const [no, newF] of newMsg.fields) {
        const oldF = oldMsg.fields.get(no);
        if (!oldF) continue;
        const c: string[] = [];
        if (oldF.name !== newF.name) c.push(`name: "${oldF.name}" → "${newF.name}"`);
        if (oldF.typeName !== newF.typeName) c.push(`type: ${oldF.typeName || oldF.type} → ${newF.typeName || newF.type}`);
        if (oldF.label !== newF.label) c.push(`label: ${oldF.label} → ${newF.label}`);
        if (c.length) changed.push({ fieldNo: no, changes: c });
    }
    if (!added.length && !removed.length && !changed.length) return null;
    return { fullName: newMsg.fullName, addedFields: added, removedFields: removed, changedFields: changed };
}

function diffSvc(oldSvc: SvcInfo, newSvc: SvcInfo): SvcChange | null {
    const added = [...newSvc.methods.values()].filter(m => !oldSvc.methods.has(m.name));
    const removed = [...oldSvc.methods.values()].filter(m => !newSvc.methods.has(m.name));
    const changed: { name: string; changes: string[] }[] = [];
    for (const [name, newM] of newSvc.methods) {
        const oldM = oldSvc.methods.get(name);
        if (!oldM) continue;
        const c: string[] = [];
        if (oldM.input !== newM.input) c.push(`input: ${oldM.input} → ${newM.input}`);
        if (oldM.output !== newM.output) c.push(`output: ${oldM.output} → ${newM.output}`);
        if (oldM.serverStreaming !== newM.serverStreaming) c.push(`streaming: ${oldM.serverStreaming} → ${newM.serverStreaming}`);
        if (c.length) changed.push({ name, changes: c });
    }
    if (!added.length && !removed.length && !changed.length) return null;
    return { fullName: newSvc.fullName, addedMethods: added, removedMethods: removed, changedMethods: changed };
}

// ═══════════════════════════════════════════════════════════════
// SDK 影響分析
// ═══════════════════════════════════════════════════════════════

const SDK_DEPS: { msg: string; fields: string[]; usedIn: string; desc: string }[] = [
    { msg: "exa.cortex_pb.CortexStepRunCommand", fields: ["commandLine","proposedCommandLine","shouldAutoRun","stdout","stderr","cwd"], usedIn: "types.ts, cascade.ts", desc: "コマンド実行ステップ" },
    { msg: "exa.cortex_pb.CortexStepPlannerResponse", fields: ["response","thinking"], usedIn: "types.ts, cascade.ts", desc: "AI レスポンス" },
    { msg: "exa.cortex_pb.RequestedInteraction", fields: ["interaction"], usedIn: "cascade.ts", desc: "インタラクション oneof" },
    { msg: "exa.cortex_pb.FilePermissionInteractionSpec", fields: ["absolutePathUri","isDirectory"], usedIn: "cascade.ts", desc: "ファイルパーミッション" },
    { msg: "exa.cortex_pb.CortexStepStatus", fields: [], usedIn: "types.ts", desc: "ステップステータス enum" },
    { msg: "exa.cortex_pb.CascadeRunStatus", fields: [], usedIn: "types.ts", desc: "Cascade ステータス enum" },
    { msg: "exa.cortex_pb.PermissionScope", fields: [], usedIn: "types.ts, cascade.ts", desc: "パーミッションスコープ enum" },
    { msg: "gemini_coder.Step", fields: ["step","status","requestedInteraction"], usedIn: "types.ts, cascade.ts", desc: "Step メッセージ" },
    { msg: "exa.jetski_cortex_pb.CascadeState", fields: ["status","trajectory"], usedIn: "cascade.ts", desc: "Cascade 状態管理" },
    { msg: "gemini_coder.Trajectory", fields: ["steps","trajectoryId"], usedIn: "cascade.ts", desc: "Trajectory" },
];

const KNOWN_STEP_CASES = [
    "userInput","plannerResponse","runCommand","commandStatus","sendCommandInput",
    "shellExec","readTerminal","viewFile","viewFileOutline","viewCodeItem",
    "listDirectory","viewContentChunk","writeToFile","fileChange","proposeCode",
    "fileBreakdown","codeAction","codeAcknowledgement","deleteDirectory","move",
    "grepSearch","find","codeSearch","internalSearch","trajectorySearch","findAllReferences",
    "openBrowserUrl","readBrowserPage","captureBrowserScreenshot","clickBrowserPixel",
    "executeBrowserJavascript","listBrowserPages","browserGetDom","browserInput",
    "browserMoveMouse","browserSelectOption","browserScrollUp","browserScrollDown",
    "browserScroll","browserClickElement","browserPressKey","browserSubagent",
    "browserResizeWindow","browserDragPixelToPixel","browserMouseWheel","browserMouseUp",
    "browserMouseDown","browserRefreshPage","browserListNetworkRequests",
    "browserGetNetworkRequest","captureBrowserConsoleLogs",
    "searchWeb","readUrlContent","searchKnowledgeBase","lookupKnowledgeBase",
    "knowledgeGeneration","knowledgeArtifacts",
    "systemMessage","ephemeralMessage","errorMessage","finish","checkpoint",
    "taskBoundary","notifyUser","suggestedResponses","lintDiff","compile",
    "gitCommit","generateImage","mcpTool","listResources","readResource",
    "clipboard","wait","dummy","generic","planInput","mquery",
    "memory","retrieveMemory","managerFeedback","toolCallProposal","toolCallChoice",
    "trajectoryChoice","brainUpdate","addAnnotation","proposalFeedback",
    "conversationHistory","kiInsertion","agencyToolCall","runExtensionCode",
    "workspaceApi","compileApplet","installAppletDependencies","installAppletPackage",
    "setUpFirebase","restartDevServer","deployFirebase","lintApplet",
    "defineNewEnvVariable","checkDeployStatus","postPrReview",
];

const KNOWN_INTERACTION_CASES = [
    "runCommand","filePermission","openBrowserUrl",
    "executeBrowserJavascript","captureBrowserScreenshot","clickBrowserPixel",
    "browserAction","openBrowserSetup","confirmBrowserSetup",
    "sendCommandInput","mcp",
];

export function analyzeImpact(
    diff: DiffResult,
    newDescs: Map<string, InstanceType<typeof FileDescriptorProto>>,
): ImpactItem[] {
    const items: ImpactItem[] = [];
    const newS = collectSchema(newDescs);

    // 1. SDK 依存メッセージの変更
    for (const dep of SDK_DEPS) {
        if (diff.removedMessages.includes(dep.msg)) {
            items.push({ severity: "🔴 HIGH", message: `${dep.msg} が完全に削除されました`, file: dep.usedIn, action: `${dep.desc} — 大幅な修正が必要` });
            continue;
        }
        const change = diff.changedMessages.find(c => c.fullName === dep.msg);
        if (!change) continue;
        for (const r of change.removedFields) {
            if (dep.fields.includes(r.name)) {
                items.push({ severity: "🔴 HIGH", message: `${dep.msg}.${r.name} が削除`, file: dep.usedIn, action: `${dep.desc} — フィールドアクセスの修正が必要` });
            }
        }
        for (const c of change.changedFields) {
            items.push({ severity: "🔴 HIGH", message: `${dep.msg} field ${c.fieldNo}: ${c.changes.join(", ")}`, file: dep.usedIn, action: `${dep.desc} — フィールド変更の反映が必要` });
        }
        for (const a of change.addedFields) {
            items.push({ severity: "🟢 LOW", message: `${dep.msg} に新フィールド "${a.name}" (no=${a.no})`, file: dep.usedIn, action: `新フィールドの利用を検討` });
        }
        // Enum の変更
        const enumChange = diff.changedEnums.find(c => c.fullName === dep.msg);
        if (enumChange) {
            for (const a of enumChange.addedValues) items.push({ severity: "🟡 MEDIUM", message: `${dep.msg} に新 enum 値 "${a.name}" = ${a.no}`, file: dep.usedIn, action: `switch 文に新ケースを追加` });
            for (const r of enumChange.removedValues) items.push({ severity: "🟡 MEDIUM", message: `${dep.msg} から enum 値 "${r.name}" が削除`, file: dep.usedIn, action: `不要なケースの削除を検討` });
        }
    }

    // 2. Step.step oneof の新ケース
    const stepMsg = newS.messages.get("gemini_coder.Step");
    if (stepMsg) {
        for (const f of stepMsg.fields.values()) {
            if (f.oneof === "step" && !KNOWN_STEP_CASES.includes(f.name)) {
                items.push({ severity: "🟡 MEDIUM", message: `Step.step oneof に未分類ケース "${f.name}" (no=${f.no})`, file: "types.ts (STEP_CATEGORY_MAP)", action: `STEP_CATEGORY_MAP に "${f.name}" を追加` });
            }
        }
    }

    // 3. RequestedInteraction.interaction oneof の新ケース
    const interMsg = newS.messages.get("exa.cortex_pb.RequestedInteraction");
    if (interMsg) {
        for (const f of interMsg.fields.values()) {
            if (f.oneof === "interaction" && !KNOWN_INTERACTION_CASES.includes(f.name)) {
                items.push({ severity: "🟡 MEDIUM", message: `RequestedInteraction に新ケース "${f.name}"`, file: "cascade.ts (buildApprovalRequest)", action: `switch 文に新ケースを追加` });
            }
        }
    }

    // 4. サービスメソッドの変更
    for (const sc of diff.changedServices) {
        for (const a of sc.addedMethods) items.push({ severity: "🟢 LOW", message: `${sc.fullName} に新 RPC "${a.name}"`, file: "cascade.ts / client.ts", action: `新メソッドの利用を検討` });
        for (const r of sc.removedMethods) items.push({ severity: "🔴 HIGH", message: `${sc.fullName} から RPC "${r.name}" が削除`, file: "cascade.ts / client.ts", action: `削除 RPC の呼び出しコードを修正` });
    }

    return items;
}

// ═══════════════════════════════════════════════════════════════
// レポート出力
// ═══════════════════════════════════════════════════════════════

export function printReport(diff: DiffResult, impacts: ImpactItem[]) {
    const c = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", magenta: "\x1b[35m", cyan: "\x1b[36m" };

    const total = diff.addedMessages.length + diff.removedMessages.length + diff.changedMessages.length +
        diff.addedEnums.length + diff.removedEnums.length + diff.changedEnums.length +
        diff.addedServices.length + diff.removedServices.length + diff.changedServices.length;

    console.log(`\n${c.bold}${"═".repeat(60)}${c.reset}`);
    console.log(`${c.bold}${c.cyan}  Proto Schema Diff Report${c.reset}`);
    console.log(`${c.bold}${"═".repeat(60)}${c.reset}\n`);

    if (total === 0) { console.log(`${c.green}  ✅ 変更なし — スキーマは同一です${c.reset}\n`); return; }

    // Messages
    if (diff.addedMessages.length + diff.removedMessages.length + diff.changedMessages.length > 0) {
        console.log(`${c.bold}📦 Messages${c.reset}`);
        for (const n of diff.addedMessages) console.log(`  ${c.green}[NEW]${c.reset}     ${n}`);
        for (const n of diff.removedMessages) console.log(`  ${c.red}[REMOVED]${c.reset} ${n}`);
        for (const ch of diff.changedMessages) {
            console.log(`  ${c.yellow}[CHANGED]${c.reset} ${ch.fullName}`);
            for (const f of ch.addedFields) console.log(`    ${c.green}+ field ${f.no}: ${f.name} (${f.typeName || f.type})${c.reset}`);
            for (const f of ch.removedFields) console.log(`    ${c.red}- field ${f.no}: ${f.name}${c.reset}`);
            for (const f of ch.changedFields) console.log(`    ${c.yellow}~ field ${f.fieldNo}: ${f.changes.join(", ")}${c.reset}`);
        }
        console.log();
    }

    // Enums
    if (diff.addedEnums.length + diff.removedEnums.length + diff.changedEnums.length > 0) {
        console.log(`${c.bold}📋 Enums${c.reset}`);
        for (const n of diff.addedEnums) console.log(`  ${c.green}[NEW]${c.reset}     ${n}`);
        for (const n of diff.removedEnums) console.log(`  ${c.red}[REMOVED]${c.reset} ${n}`);
        for (const ch of diff.changedEnums) {
            console.log(`  ${c.yellow}[CHANGED]${c.reset} ${ch.fullName}`);
            for (const v of ch.addedValues) console.log(`    ${c.green}+ ${v.name} = ${v.no}${c.reset}`);
            for (const v of ch.removedValues) console.log(`    ${c.red}- ${v.name} = ${v.no}${c.reset}`);
        }
        console.log();
    }

    // Services
    if (diff.addedServices.length + diff.removedServices.length + diff.changedServices.length > 0) {
        console.log(`${c.bold}🔌 Services${c.reset}`);
        for (const n of diff.addedServices) console.log(`  ${c.green}[NEW]${c.reset}     ${n}`);
        for (const n of diff.removedServices) console.log(`  ${c.red}[REMOVED]${c.reset} ${n}`);
        for (const ch of diff.changedServices) {
            console.log(`  ${c.yellow}[CHANGED]${c.reset} ${ch.fullName}`);
            for (const m of ch.addedMethods) console.log(`    ${c.green}+ rpc ${m.name}${c.reset}`);
            for (const m of ch.removedMethods) console.log(`    ${c.red}- rpc ${m.name}${c.reset}`);
            for (const m of ch.changedMethods) console.log(`    ${c.yellow}~ rpc ${m.name}: ${m.changes.join(", ")}${c.reset}`);
        }
        console.log();
    }

    // Stats
    console.log(`${c.dim}────────────────────────────────────────${c.reset}`);
    console.log(`${c.dim}Messages: +${diff.addedMessages.length} -${diff.removedMessages.length} ~${diff.changedMessages.length}${c.reset}`);
    console.log(`${c.dim}Enums:    +${diff.addedEnums.length} -${diff.removedEnums.length} ~${diff.changedEnums.length}${c.reset}`);
    console.log(`${c.dim}Services: +${diff.addedServices.length} -${diff.removedServices.length} ~${diff.changedServices.length}${c.reset}\n`);

    // SDK Impact
    if (impacts.length > 0) {
        console.log(`${c.bold}${"═".repeat(60)}${c.reset}`);
        console.log(`${c.bold}${c.magenta}  SDK Impact Analysis${c.reset}`);
        console.log(`${c.bold}${"═".repeat(60)}${c.reset}\n`);
        const high = impacts.filter(i => i.severity === "🔴 HIGH");
        const medium = impacts.filter(i => i.severity === "🟡 MEDIUM");
        const low = impacts.filter(i => i.severity === "🟢 LOW");
        for (const group of [high, medium, low]) {
            for (const item of group) {
                console.log(`  ${item.severity} ${item.message}`);
                console.log(`    ${c.dim}File: ${item.file}${c.reset}`);
                console.log(`    ${c.dim}Action: ${item.action}${c.reset}\n`);
            }
        }
        if (high.length > 0) console.log(`${c.red}${c.bold}  ⚠️  ${high.length} 件の HIGH 影響 — 修正が必要です${c.reset}\n`);
        else if (medium.length > 0) console.log(`${c.yellow}  ⚡ ${medium.length} 件の MEDIUM 影響を確認してください${c.reset}\n`);
        else console.log(`${c.green}  ✅ 影響は小さいです${c.reset}\n`);
    } else {
        console.log(`${c.green}  ✅ SDK への影響はありません${c.reset}\n`);
    }
}
