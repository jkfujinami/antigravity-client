#!/usr/bin/env npx tsx
/**
 * proto_diff.ts — Protobuf スキーマの差分検出 + SDK 影響分析
 *
 * 使い方:
 *   npx tsx scripts/proto_diff.ts --old <old_js_files...> --new <new_js_files...>
 *
 * 例:
 *   npx tsx scripts/proto_diff.ts \
 *     --old media_chat_formatted.old.js extension_formatted.old.js \
 *     --new media_chat_formatted.js extension_formatted.js
 *
 * 出力: Messages/Enums/Services の追加・削除・変更を一覧表示し、
 *       SDK (types.ts, cascade.ts) への影響を自動分析する。
 */

import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";

// ═══════════════════════════════════════════════════════════════
// 1. 型定義 (generate_from_js.ts と同一)
// ═══════════════════════════════════════════════════════════════

interface FieldDef {
    no: number;
    name: string;
    kind: string;
    T_var?: string;
    T_scalar?: string;
    repeated?: boolean;
    oneof?: string;
    K_scalar?: string;
    V_kind?: string;
    V_T_var?: string;
    V_scalar?: string;
}

interface MessageDef {
    varName: string;
    fullName: string;
    fields: FieldDef[];
}

interface EnumDef {
    varName: string;
    fullName: string;
    values: { name: string; no: number }[];
}

interface MethodDef {
    name: string;
    I_var: string;
    O_var: string;
    serverStreaming?: boolean;
}

interface ServiceDef {
    varName: string;
    fullName: string;
    methods: MethodDef[];
}

const SCALAR_ID_MAP: Record<number, string> = {
    1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32",
    6: "fixed64", 7: "fixed32", 8: "bool", 9: "string", 11: "message",
    12: "bytes", 13: "uint32", 14: "enum", 15: "sfixed32", 16: "sfixed64",
    17: "sint32", 18: "sint64"
};

// ═══════════════════════════════════════════════════════════════
// 2. パーサー (generate_from_js.ts から移植)
// ═══════════════════════════════════════════════════════════════

interface ParsedSchema {
    messages: Map<string, MessageDef>;  // fullName -> def
    enums: Map<string, EnumDef>;        // fullName -> def
    services: Map<string, ServiceDef>;  // fullName -> def
    varToFull: Map<string, string>;     // varName -> fullName (message/enum)
}

function parseJsFiles(files: string[]): ParsedSchema {
    const messageMap = new Map<string, MessageDef>();
    const enumMap = new Map<string, EnumDef>();
    const serviceMap = new Map<string, ServiceDef>();
    const varToMsg = new Map<string, MessageDef>();
    const varToEnum = new Map<string, EnumDef>();
    const varToFull = new Map<string, string>();

    const addMessage = (varName: string, fullName: string) => {
        if (!messageMap.has(fullName)) {
            messageMap.set(fullName, { varName, fullName, fields: [] });
        }
        varToMsg.set(varName, messageMap.get(fullName)!);
        varToFull.set(varName, fullName);
    };

    const addEnum = (varName: string, fullName: string, values: { name: string; no: number }[]) => {
        if (!enumMap.has(fullName)) {
            enumMap.set(fullName, { varName, fullName, values });
        }
        varToEnum.set(varName, enumMap.get(fullName)!);
        varToFull.set(varName, fullName);
    };

    const addService = (varName: string, fullName: string, methods: MethodDef[]) => {
        if (!serviceMap.has(fullName)) {
            serviceMap.set(fullName, { varName, fullName, methods });
        }
    };

    // Pass 1: scan definitions
    for (const file of files) {
        if (!fs.existsSync(file)) {
            console.error(`⚠️  File not found: ${file}`);
            continue;
        }
        const content = fs.readFileSync(file, "utf-8");
        scanDefinitions(content, addMessage, addEnum, addService);
    }

    // Pass 2: parse fields
    for (const file of files) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, "utf-8");
        parseMessageFields(content, varToMsg);
    }

    return { messages: messageMap, enums: enumMap, services: serviceMap, varToFull };
}

// ── scanDefinitions (generate_from_js.ts と同一ロジック) ──

function scanDefinitions(
    content: string,
    addMessage: (varName: string, fullName: string) => void,
    addEnum: (varName: string, fullName: string, values: { name: string; no: number }[]) => void,
    addService: (varName: string, fullName: string, methods: MethodDef[]) => void
) {
    const sourceFile = ts.createSourceFile("temp.js", content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
        // Pattern 1: Class static property
        if (ts.isPropertyDeclaration(node) &&
            node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) &&
            ts.isIdentifier(node.name) && node.name.text === "typeName" &&
            node.initializer && ts.isStringLiteral(node.initializer)) {

            const fullName = node.initializer.text;
            const classExpr = node.parent;
            if (ts.isClassExpression(classExpr) || ts.isClassDeclaration(classExpr)) {
                if (ts.isClassDeclaration(classExpr) && classExpr.name) {
                    addMessage(classExpr.name.text, fullName);
                } else {
                    const parent = classExpr.parent;
                    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                        const left = parent.left;
                        if (ts.isIdentifier(left)) addMessage(left.text, fullName);
                    } else if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
                        addMessage(parent.name.text, fullName);
                    }
                }
            }
        }

        // Pattern 2: Property Assignment
        if (ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(node.left) &&
            node.left.name.text === "typeName") {
            const varExpr = node.left.expression;
            if (ts.isIdentifier(varExpr) && ts.isStringLiteral(node.right)) {
                addMessage(varExpr.text, node.right.text);
            }
        }

        // Pattern 3: Enum
        if (ts.isCallExpression(node)) {
            const expr = node.expression;
            if (ts.isPropertyAccessExpression(expr) && expr.name.text === "setEnumType") {
                const args = node.arguments;
                if (args.length >= 3) {
                    const varArg = args[0], nameArg = args[1], valuesArg = args[2];
                    if (ts.isIdentifier(varArg) && ts.isStringLiteral(nameArg) && ts.isArrayLiteralExpression(valuesArg)) {
                        const values: { name: string; no: number }[] = [];
                        for (const elt of valuesArg.elements) {
                            if (ts.isObjectLiteralExpression(elt)) {
                                let valName = "", valNo = -1;
                                elt.properties.forEach(p => {
                                    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                                        if (p.name.text === "name" && ts.isStringLiteral(p.initializer)) valName = p.initializer.text;
                                        if (p.name.text === "no" && ts.isNumericLiteral(p.initializer)) valNo = parseInt(p.initializer.text, 10);
                                    }
                                });
                                if (valName && valNo !== -1) values.push({ name: valName, no: valNo });
                            }
                        }
                        addEnum(varArg.text, nameArg.text, values);
                    }
                }
            }
        }

        // Pattern 4: Service
        if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer) && ts.isIdentifier(node.name)) {
            const varName = node.name.text;
            let typeName = "";
            let methodsNode: ts.ObjectLiteralExpression | undefined;

            node.initializer.properties.forEach(p => {
                if (ts.isPropertyAssignment(p)) {
                    if (ts.isIdentifier(p.name) && p.name.text === "typeName" && ts.isStringLiteral(p.initializer)) {
                        typeName = p.initializer.text;
                    }
                    if (ts.isIdentifier(p.name) && p.name.text === "methods" && ts.isObjectLiteralExpression(p.initializer)) {
                        methodsNode = p.initializer;
                    }
                }
            });

            if (typeName && methodsNode) {
                const methods: MethodDef[] = [];
                methodsNode.properties.forEach(mp => {
                    if (ts.isPropertyAssignment(mp) && ts.isObjectLiteralExpression(mp.initializer)) {
                        let mName = "", I_var = "", O_var = "";
                        let serverStreaming = false;
                        mp.initializer.properties.forEach(prop => {
                            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                                const val = prop.initializer;
                                if (prop.name.text === "name" && ts.isStringLiteral(val)) mName = val.text;
                                if ((prop.name.text === "I" || prop.name.text === "i") && ts.isIdentifier(val)) I_var = val.text;
                                if ((prop.name.text === "O" || prop.name.text === "o") && ts.isIdentifier(val)) O_var = val.text;
                                if (prop.name.text === "kind") {
                                    if (ts.isPropertyAccessExpression(val) && val.name.text.includes("ServerStreaming")) {
                                        serverStreaming = true;
                                    }
                                }
                            }
                        });
                        if (mName && I_var && O_var) methods.push({ name: mName, I_var, O_var, serverStreaming });
                    }
                });
                addService(varName, typeName, methods);
            }
        }

        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
}

// ── parseMessageFields (同一ロジック) ──

function parseMessageFields(content: string, varToMsg: Map<string, MessageDef>) {
    const sourceFile = ts.createSourceFile("temp.js", content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
        let fieldsNode: ts.Expression | undefined;
        let varName: string | undefined;

        if (ts.isPropertyDeclaration(node) &&
            node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) &&
            ts.isIdentifier(node.name) && node.name.text === "fields" &&
            node.initializer) {
            const classExpr = node.parent;
            if (ts.isClassExpression(classExpr)) {
                const parent = classExpr.parent;
                if (ts.isBinaryExpression(parent) && ts.isIdentifier(parent.left)) {
                    varName = parent.left.text;
                    fieldsNode = node.initializer;
                }
            } else if (ts.isClassDeclaration(classExpr) && classExpr.name) {
                varName = classExpr.name.text;
                fieldsNode = node.initializer;
            }
        }

        if (ts.isBinaryExpression(node) &&
            node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
            ts.isPropertyAccessExpression(node.left) &&
            node.left.name.text === "fields") {
            const varExpr = node.left.expression;
            if (ts.isIdentifier(varExpr)) {
                varName = varExpr.text;
                fieldsNode = node.right;
            }
        }

        if (varName && fieldsNode) {
            const messageDef = varToMsg.get(varName);
            if (messageDef) {
                if (ts.isCallExpression(fieldsNode)) {
                    const args = fieldsNode.arguments;
                    if (args.length > 0) {
                        const arg = args[0];
                        if (ts.isArrowFunction(arg)) {
                            const body = arg.body;
                            let arrayNode: ts.ArrayLiteralExpression | undefined;
                            if (ts.isArrayLiteralExpression(body)) {
                                arrayNode = body;
                            } else if (ts.isBlock(body)) {
                                body.statements.forEach(stmt => {
                                    if (ts.isReturnStatement(stmt) && stmt.expression && ts.isArrayLiteralExpression(stmt.expression)) {
                                        arrayNode = stmt.expression;
                                    }
                                });
                            }
                            if (arrayNode) {
                                const parsedFields = parseFieldList(arrayNode);
                                if (messageDef.fields.length === 0 && parsedFields.length > 0) {
                                    messageDef.fields = parsedFields;
                                }
                            }
                        }
                    }
                }
            }
        }

        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
}

function parseFieldList(arrayNode: ts.ArrayLiteralExpression): FieldDef[] {
    const fields: FieldDef[] = [];
    for (const elt of arrayNode.elements) {
        if (ts.isObjectLiteralExpression(elt)) {
            const f: FieldDef = { no: 0, name: "", kind: "scalar" };
            elt.properties.forEach(p => {
                if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
                    const val = p.initializer;
                    if (p.name.text === "no" && ts.isNumericLiteral(val)) f.no = parseInt(val.text, 10);
                    if (p.name.text === "name" && ts.isStringLiteral(val)) f.name = val.text;
                    if (p.name.text === "kind" && ts.isStringLiteral(val)) f.kind = val.text;
                    if (p.name.text === "T" || p.name.text === "t") {
                        if (ts.isIdentifier(val)) f.T_var = val.text;
                        else if (ts.isCallExpression(val)) {
                            if (val.arguments.length > 0) {
                                const arg = val.arguments[0];
                                if (ts.isIdentifier(arg)) f.T_var = arg.text;
                            }
                        }
                        else if (ts.isNumericLiteral(val)) f.T_scalar = SCALAR_ID_MAP[parseInt(val.text, 10)];
                        else if (ts.isPropertyAccessExpression(val)) f.T_var = val.name.text;
                    }
                    if (p.name.text === "K" && ts.isNumericLiteral(val)) f.K_scalar = val.text;
                    if (p.name.text === "V") {
                        if (ts.isNumericLiteral(val)) {
                            f.V_kind = "scalar";
                            f.V_scalar = SCALAR_ID_MAP[parseInt(val.text, 10)];
                        } else if (ts.isObjectLiteralExpression(val)) {
                            val.properties.forEach(vp => {
                                if (ts.isPropertyAssignment(vp) && ts.isIdentifier(vp.name)) {
                                    const vval = vp.initializer;
                                    if (vp.name.text === "kind" && ts.isStringLiteral(vval)) f.V_kind = vval.text;
                                    if (vp.name.text === "T" || vp.name.text === "t") {
                                        if (ts.isIdentifier(vval)) f.V_T_var = vval.text;
                                        else if (ts.isCallExpression(vval)) {
                                            if (vval.arguments.length > 0) {
                                                const arg = vval.arguments[0];
                                                if (ts.isIdentifier(arg)) f.V_T_var = arg.text;
                                            }
                                        }
                                        else if (ts.isNumericLiteral(vval)) f.V_scalar = SCALAR_ID_MAP[parseInt(vval.text, 10)];
                                        else if (ts.isPropertyAccessExpression(vval)) f.V_T_var = vval.name.text;
                                    }
                                }
                            });
                        }
                    }
                    if (p.name.text === "repeat" || p.name.text === "repeated") f.repeated = true;
                    if (p.name.text === "oneof" && ts.isStringLiteral(val)) f.oneof = val.text;
                }
            });
            if (f.name && f.no) fields.push(f);
        }
    }
    return fields;
}

// ═══════════════════════════════════════════════════════════════
// 3. 差分検出
// ═══════════════════════════════════════════════════════════════

interface DiffResult {
    // Messages
    addedMessages: string[];
    removedMessages: string[];
    changedMessages: MessageChange[];
    // Enums
    addedEnums: string[];
    removedEnums: string[];
    changedEnums: EnumChange[];
    // Services
    addedServices: string[];
    removedServices: string[];
    changedServices: ServiceChange[];
}

interface MessageChange {
    fullName: string;
    addedFields: FieldDef[];
    removedFields: FieldDef[];
    changedFields: FieldChange[];
}

interface FieldChange {
    fieldNo: number;
    oldField: FieldDef;
    newField: FieldDef;
    changes: string[];  // 人間可読な変更説明
}

interface EnumChange {
    fullName: string;
    addedValues: { name: string; no: number }[];
    removedValues: { name: string; no: number }[];
}

interface ServiceChange {
    fullName: string;
    addedMethods: MethodDef[];
    removedMethods: MethodDef[];
    changedMethods: { name: string; changes: string[] }[];
}

function computeDiff(oldSchema: ParsedSchema, newSchema: ParsedSchema): DiffResult {
    const result: DiffResult = {
        addedMessages: [], removedMessages: [], changedMessages: [],
        addedEnums: [], removedEnums: [], changedEnums: [],
        addedServices: [], removedServices: [], changedServices: [],
    };

    // ── Messages ──
    for (const [name] of newSchema.messages) {
        if (!oldSchema.messages.has(name)) result.addedMessages.push(name);
    }
    for (const [name] of oldSchema.messages) {
        if (!newSchema.messages.has(name)) result.removedMessages.push(name);
    }
    for (const [name, newMsg] of newSchema.messages) {
        const oldMsg = oldSchema.messages.get(name);
        if (!oldMsg) continue;
        const change = diffMessage(oldMsg, newMsg);
        if (change) result.changedMessages.push(change);
    }

    // ── Enums ──
    for (const [name] of newSchema.enums) {
        if (!oldSchema.enums.has(name)) result.addedEnums.push(name);
    }
    for (const [name] of oldSchema.enums) {
        if (!newSchema.enums.has(name)) result.removedEnums.push(name);
    }
    for (const [name, newEnum] of newSchema.enums) {
        const oldEnum = oldSchema.enums.get(name);
        if (!oldEnum) continue;
        const change = diffEnum(oldEnum, newEnum);
        if (change) result.changedEnums.push(change);
    }

    // ── Services ──
    for (const [name] of newSchema.services) {
        if (!oldSchema.services.has(name)) result.addedServices.push(name);
    }
    for (const [name] of oldSchema.services) {
        if (!newSchema.services.has(name)) result.removedServices.push(name);
    }
    for (const [name, newSvc] of newSchema.services) {
        const oldSvc = oldSchema.services.get(name);
        if (!oldSvc) continue;
        const change = diffService(oldSvc, newSvc);
        if (change) result.changedServices.push(change);
    }

    return result;
}

function diffMessage(oldMsg: MessageDef, newMsg: MessageDef): MessageChange | null {
    const oldByNo = new Map(oldMsg.fields.map(f => [f.no, f]));
    const newByNo = new Map(newMsg.fields.map(f => [f.no, f]));

    const added = newMsg.fields.filter(f => !oldByNo.has(f.no));
    const removed = oldMsg.fields.filter(f => !newByNo.has(f.no));
    const changed: FieldChange[] = [];

    for (const [no, newF] of newByNo) {
        const oldF = oldByNo.get(no);
        if (!oldF) continue;
        const changes: string[] = [];
        if (oldF.name !== newF.name) changes.push(`name: "${oldF.name}" → "${newF.name}"`);
        if (oldF.kind !== newF.kind) changes.push(`kind: ${oldF.kind} → ${newF.kind}`);
        if (oldF.T_scalar !== newF.T_scalar) changes.push(`type: ${oldF.T_scalar || oldF.T_var} → ${newF.T_scalar || newF.T_var}`);
        if (oldF.T_var !== newF.T_var) changes.push(`T_var: ${oldF.T_var} → ${newF.T_var}`);
        if (oldF.repeated !== newF.repeated) changes.push(`repeated: ${!!oldF.repeated} → ${!!newF.repeated}`);
        if (oldF.oneof !== newF.oneof) changes.push(`oneof: ${oldF.oneof || "(none)"} → ${newF.oneof || "(none)"}`);
        if (changes.length > 0) changed.push({ fieldNo: no, oldField: oldF, newField: newF, changes });
    }

    if (added.length === 0 && removed.length === 0 && changed.length === 0) return null;
    return { fullName: newMsg.fullName, addedFields: added, removedFields: removed, changedFields: changed };
}

function diffEnum(oldEnum: EnumDef, newEnum: EnumDef): EnumChange | null {
    const oldNos = new Set(oldEnum.values.map(v => v.no));
    const newNos = new Set(newEnum.values.map(v => v.no));
    const added = newEnum.values.filter(v => !oldNos.has(v.no));
    const removed = oldEnum.values.filter(v => !newNos.has(v.no));
    if (added.length === 0 && removed.length === 0) return null;
    return { fullName: newEnum.fullName, addedValues: added, removedValues: removed };
}

function diffService(oldSvc: ServiceDef, newSvc: ServiceDef): ServiceChange | null {
    const oldByName = new Map(oldSvc.methods.map(m => [m.name, m]));
    const newByName = new Map(newSvc.methods.map(m => [m.name, m]));
    const added = newSvc.methods.filter(m => !oldByName.has(m.name));
    const removed = oldSvc.methods.filter(m => !newByName.has(m.name));
    const changed: { name: string; changes: string[] }[] = [];

    for (const [name, newM] of newByName) {
        const oldM = oldByName.get(name);
        if (!oldM) continue;
        const changes: string[] = [];
        if (oldM.I_var !== newM.I_var) changes.push(`input: ${oldM.I_var} → ${newM.I_var}`);
        if (oldM.O_var !== newM.O_var) changes.push(`output: ${oldM.O_var} → ${newM.O_var}`);
        if (oldM.serverStreaming !== newM.serverStreaming) changes.push(`streaming: ${!!oldM.serverStreaming} → ${!!newM.serverStreaming}`);
        if (changes.length > 0) changed.push({ name, changes });
    }

    if (added.length === 0 && removed.length === 0 && changed.length === 0) return null;
    return { fullName: newSvc.fullName, addedMethods: added, removedMethods: removed, changedMethods: changed };
}

// ═══════════════════════════════════════════════════════════════
// 4. SDK 影響分析
// ═══════════════════════════════════════════════════════════════

// SDK が依存している Protobuf の fullName とフィールド名のマッピング
const SDK_DEPENDENCIES: {
    messageName: string;
    fields: string[];
    usedIn: string;
    description: string;
}[] = [
    {
        messageName: "exa.cortex_pb.CortexStepRunCommand",
        fields: ["commandLine", "proposedCommandLine", "shouldAutoRun", "stdout", "stderr", "cwd"],
        usedIn: "types.ts (CascadeStep), cascade.ts (emitApprovalRequests, emitCommandOutputDeltas)",
        description: "コマンド実行ステップのフィールドアクセス",
    },
    {
        messageName: "exa.cortex_pb.CortexStepPlannerResponse",
        fields: ["response", "thinking"],
        usedIn: "types.ts (CascadeStep), cascade.ts (emitTextDeltas)",
        description: "AI レスポンスのテキストフィールドアクセス",
    },
    {
        messageName: "exa.cortex_pb.RequestedInteraction",
        fields: ["interaction"],
        usedIn: "cascade.ts (emitApprovalRequests, buildApprovalRequest)",
        description: "インタラクション oneof のケース判定",
    },
    {
        messageName: "exa.cortex_pb.FilePermissionInteractionSpec",
        fields: ["absolutePathUri", "isDirectory"],
        usedIn: "cascade.ts (buildApprovalRequest filePermission case)",
        description: "ファイルパーミッション承認",
    },
    {
        messageName: "exa.cortex_pb.CortexStepStatus",
        fields: [],  // enum
        usedIn: "types.ts (toStepStatus), cascade.ts (emitApprovalRequests)",
        description: "ステップステータス enum 値の変換",
    },
    {
        messageName: "exa.cortex_pb.CascadeRunStatus",
        fields: [],  // enum
        usedIn: "types.ts (toRunStatus), cascade.ts (emitStatusChange)",
        description: "Cascade 全体ステータスの enum 変換",
    },
    {
        messageName: "exa.cortex_pb.PermissionScope",
        fields: [],  // enum
        usedIn: "types.ts (re-export), cascade.ts (approveFilePermission)",
        description: "パーミッションスコープ enum",
    },
    {
        messageName: "gemini_coder.Step",
        fields: ["step", "status", "requestedInteraction"],
        usedIn: "types.ts (CascadeStep), cascade.ts (全イベント処理)",
        description: "Step メッセージの構造 (oneof step, status, requestedInteraction)",
    },
    {
        messageName: "exa.jetski_cortex_pb.CascadeState",
        fields: ["status", "trajectory"],
        usedIn: "cascade.ts (state管理, ステップ追跡)",
        description: "Cascade の全体状態管理オブジェクト",
    },
    {
        messageName: "gemini_coder.Trajectory",
        fields: ["steps", "trajectoryId"],
        usedIn: "cascade.ts (emitStepEvents, approveCommand)",
        description: "Trajectory からの steps 配列アクセス",
    },
];

// Step.step の oneof ケースと types.ts の STEP_CATEGORY_MAP のマッピング
const STEP_CATEGORY_CASES = [
    "userInput", "plannerResponse", "runCommand", "commandStatus", "sendCommandInput",
    "shellExec", "readTerminal", "viewFile", "viewFileOutline", "viewCodeItem",
    "listDirectory", "viewContentChunk", "writeToFile", "fileChange", "proposeCode",
    "fileBreakdown", "codeAction", "codeAcknowledgement", "deleteDirectory", "move",
    "grepSearch", "find", "codeSearch", "internalSearch", "trajectorySearch", "findAllReferences",
    "openBrowserUrl", "readBrowserPage", "captureBrowserScreenshot", "clickBrowserPixel",
    "executeBrowserJavascript", "listBrowserPages", "browserGetDom", "browserInput",
    "browserMoveMouse", "browserSelectOption", "browserScrollUp", "browserScrollDown",
    "browserScroll", "browserClickElement", "browserPressKey", "browserSubagent",
    "browserResizeWindow", "browserDragPixelToPixel", "browserMouseWheel", "browserMouseUp",
    "browserMouseDown", "browserRefreshPage", "browserListNetworkRequests",
    "browserGetNetworkRequest", "captureBrowserConsoleLogs",
    "searchWeb", "readUrlContent", "searchKnowledgeBase", "lookupKnowledgeBase",
    "knowledgeGeneration", "knowledgeArtifacts",
    "systemMessage", "ephemeralMessage", "errorMessage", "finish", "checkpoint",
    "taskBoundary", "notifyUser", "suggestedResponses", "lintDiff", "compile",
    "gitCommit", "generateImage", "mcpTool", "listResources", "readResource",
    "clipboard", "wait", "dummy", "generic", "planInput", "mquery",
    "memory", "retrieveMemory", "managerFeedback", "toolCallProposal", "toolCallChoice",
    "trajectoryChoice", "brainUpdate", "addAnnotation", "proposalFeedback",
    "conversationHistory", "kiInsertion", "agencyToolCall", "runExtensionCode",
    "workspaceApi", "compileApplet", "installAppletDependencies", "installAppletPackage",
    "setUpFirebase", "restartDevServer", "deployFirebase", "lintApplet",
    "defineNewEnvVariable", "checkDeployStatus", "postPrReview",
];

interface ImpactItem {
    severity: "🔴 HIGH" | "🟡 MEDIUM" | "🟢 LOW";
    message: string;
    file: string;
    action: string;
}

function analyzeImpact(diff: DiffResult, newSchema: ParsedSchema): ImpactItem[] {
    const items: ImpactItem[] = [];

    // ── 1. SDK が依存するメッセージの変更チェック ──
    for (const dep of SDK_DEPENDENCIES) {
        // Changed
        const change = diff.changedMessages.find(c => c.fullName === dep.messageName);
        if (change) {
            // フィールドが削除された場合
            for (const removed of change.removedFields) {
                if (dep.fields.includes(removed.name)) {
                    items.push({
                        severity: "🔴 HIGH",
                        message: `${dep.messageName}.${removed.name} が削除されました`,
                        file: dep.usedIn,
                        action: `${dep.description} — フィールド "${removed.name}" へのアクセスを修正する必要があります`,
                    });
                }
            }
            // フィールド名が変わった場合
            for (const changed of change.changedFields) {
                if (dep.fields.includes(changed.oldField.name)) {
                    items.push({
                        severity: "🔴 HIGH",
                        message: `${dep.messageName} field ${changed.fieldNo}: ${changed.changes.join(", ")}`,
                        file: dep.usedIn,
                        action: `${dep.description} — フィールドの変更を反映する必要があります`,
                    });
                }
            }
            // 新フィールド追加（利用可能性の通知）
            for (const added of change.addedFields) {
                items.push({
                    severity: "🟢 LOW",
                    message: `${dep.messageName} に新フィールド "${added.name}" (no=${added.no}) が追加されました`,
                    file: dep.usedIn,
                    action: `新フィールドの利用を検討 (${dep.description})`,
                });
            }
        }

        // Removed entirely
        if (diff.removedMessages.includes(dep.messageName)) {
            items.push({
                severity: "🔴 HIGH",
                message: `${dep.messageName} が完全に削除されました`,
                file: dep.usedIn,
                action: `${dep.description} — メッセージ全体が削除されたため、大幅な修正が必要です`,
            });
        }

        // Enum changes
        const enumChange = diff.changedEnums.find(c => c.fullName === dep.messageName);
        if (enumChange) {
            for (const added of enumChange.addedValues) {
                items.push({
                    severity: "🟡 MEDIUM",
                    message: `${dep.messageName} に新しい enum 値 "${added.name}" = ${added.no} が追加されました`,
                    file: dep.usedIn,
                    action: `toStepStatus() / toRunStatus() に新しいケースを追加する必要があります`,
                });
            }
            for (const removed of enumChange.removedValues) {
                items.push({
                    severity: "🟡 MEDIUM",
                    message: `${dep.messageName} から enum 値 "${removed.name}" = ${removed.no} が削除されました`,
                    file: dep.usedIn,
                    action: `不要なケースの削除を検討`,
                });
            }
        }
    }

    // ── 2. Step.step の oneof に新しいケースが追加されたかチェック ──
    const stepMsg = newSchema.messages.get("gemini_coder.Step") ||
                    newSchema.messages.get("jetski.gemini_coder.Step");
    if (stepMsg) {
        const oneofFields = stepMsg.fields.filter(f => f.oneof === "step");
        for (const field of oneofFields) {
            if (!STEP_CATEGORY_CASES.includes(field.name)) {
                items.push({
                    severity: "🟡 MEDIUM",
                    message: `Step.step oneof に未分類のケース "${field.name}" (no=${field.no}) が新しく追加されました`,
                    file: "types.ts (STEP_CATEGORY_MAP)",
                    action: `STEP_CATEGORY_MAP に "${field.name}" のカテゴリを追加してください`,
                });
            }
        }
    }

    // ── 3. RequestedInteraction の oneof に新しいケースが追加されたかチェック ──
    const interactionMsg = newSchema.messages.get("exa.cortex_pb.RequestedInteraction");
    if (interactionMsg) {
        const knownCases = [
            "runCommand", "filePermission", "openBrowserUrl",
            "executeBrowserJavascript", "captureBrowserScreenshot", "clickBrowserPixel",
            "browserAction", "openBrowserSetup", "confirmBrowserSetup",
            "sendCommandInput", "mcp",
        ];
        const oneofFields = interactionMsg.fields.filter(f => f.oneof === "interaction");
        for (const field of oneofFields) {
            if (!knownCases.includes(field.name)) {
                items.push({
                    severity: "🟡 MEDIUM",
                    message: `RequestedInteraction.interaction oneof に新ケース "${field.name}" が追加されました`,
                    file: "cascade.ts (buildApprovalRequest)",
                    action: `buildApprovalRequest() のスイッチに新しいケースを追加してください`,
                });
            }
        }
    }

    // ── 4. Service メソッドの変更 ──
    for (const svcChange of diff.changedServices) {
        for (const added of svcChange.addedMethods) {
            items.push({
                severity: "🟢 LOW",
                message: `${svcChange.fullName} に新 RPC "${added.name}" が追加されました`,
                file: "cascade.ts / client.ts",
                action: `新メソッドの利用を検討`,
            });
        }
        for (const removed of svcChange.removedMethods) {
            items.push({
                severity: "🔴 HIGH",
                message: `${svcChange.fullName} から RPC "${removed.name}" が削除されました`,
                file: "cascade.ts / client.ts",
                action: `削除された RPC を呼び出しているコードを修正する必要があります`,
            });
        }
    }

    return items;
}

// ═══════════════════════════════════════════════════════════════
// 5. 出力フォーマット
// ═══════════════════════════════════════════════════════════════

function printDiff(diff: DiffResult, impacts: ImpactItem[]) {
    const c = {
        reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
        red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
        blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
    };

    const totalChanges =
        diff.addedMessages.length + diff.removedMessages.length + diff.changedMessages.length +
        diff.addedEnums.length + diff.removedEnums.length + diff.changedEnums.length +
        diff.addedServices.length + diff.removedServices.length + diff.changedServices.length;

    console.log(`\n${c.bold}${"═".repeat(60)}${c.reset}`);
    console.log(`${c.bold}${c.cyan}  Proto Schema Diff Report${c.reset}`);
    console.log(`${c.bold}${"═".repeat(60)}${c.reset}\n`);

    if (totalChanges === 0) {
        console.log(`${c.green}  ✅ 変更なし — スキーマは同一です${c.reset}\n`);
        return;
    }

    // ── Messages ──
    if (diff.addedMessages.length + diff.removedMessages.length + diff.changedMessages.length > 0) {
        console.log(`${c.bold}📦 Messages${c.reset}`);
        for (const name of diff.addedMessages) {
            console.log(`  ${c.green}[NEW]${c.reset}     ${name}`);
        }
        for (const name of diff.removedMessages) {
            console.log(`  ${c.red}[REMOVED]${c.reset} ${name}`);
        }
        for (const change of diff.changedMessages) {
            console.log(`  ${c.yellow}[CHANGED]${c.reset} ${change.fullName}`);
            for (const f of change.addedFields) {
                console.log(`    ${c.green}+ field ${f.no}: ${f.name} (${f.kind})${c.reset}`);
            }
            for (const f of change.removedFields) {
                console.log(`    ${c.red}- field ${f.no}: ${f.name} (${f.kind})${c.reset}`);
            }
            for (const f of change.changedFields) {
                console.log(`    ${c.yellow}~ field ${f.fieldNo}: ${f.changes.join(", ")}${c.reset}`);
            }
        }
        console.log();
    }

    // ── Enums ──
    if (diff.addedEnums.length + diff.removedEnums.length + diff.changedEnums.length > 0) {
        console.log(`${c.bold}📋 Enums${c.reset}`);
        for (const name of diff.addedEnums) {
            console.log(`  ${c.green}[NEW]${c.reset}     ${name}`);
        }
        for (const name of diff.removedEnums) {
            console.log(`  ${c.red}[REMOVED]${c.reset} ${name}`);
        }
        for (const change of diff.changedEnums) {
            console.log(`  ${c.yellow}[CHANGED]${c.reset} ${change.fullName}`);
            for (const v of change.addedValues) {
                console.log(`    ${c.green}+ ${v.name} = ${v.no}${c.reset}`);
            }
            for (const v of change.removedValues) {
                console.log(`    ${c.red}- ${v.name} = ${v.no}${c.reset}`);
            }
        }
        console.log();
    }

    // ── Services ──
    if (diff.addedServices.length + diff.removedServices.length + diff.changedServices.length > 0) {
        console.log(`${c.bold}🔌 Services${c.reset}`);
        for (const name of diff.addedServices) {
            console.log(`  ${c.green}[NEW]${c.reset}     ${name}`);
        }
        for (const name of diff.removedServices) {
            console.log(`  ${c.red}[REMOVED]${c.reset} ${name}`);
        }
        for (const change of diff.changedServices) {
            console.log(`  ${c.yellow}[CHANGED]${c.reset} ${change.fullName}`);
            for (const m of change.addedMethods) {
                console.log(`    ${c.green}+ rpc ${m.name}${c.reset}`);
            }
            for (const m of change.removedMethods) {
                console.log(`    ${c.red}- rpc ${m.name}${c.reset}`);
            }
            for (const m of change.changedMethods) {
                console.log(`    ${c.yellow}~ rpc ${m.name}: ${m.changes.join(", ")}${c.reset}`);
            }
        }
        console.log();
    }

    // ── Summary stats ──
    console.log(`${c.dim}────────────────────────────────────────${c.reset}`);
    console.log(`${c.dim}Messages: +${diff.addedMessages.length} -${diff.removedMessages.length} ~${diff.changedMessages.length}${c.reset}`);
    console.log(`${c.dim}Enums:    +${diff.addedEnums.length} -${diff.removedEnums.length} ~${diff.changedEnums.length}${c.reset}`);
    console.log(`${c.dim}Services: +${diff.addedServices.length} -${diff.removedServices.length} ~${diff.changedServices.length}${c.reset}`);
    console.log();

    // ── SDK Impact ──
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
                console.log(`    ${c.dim}Action: ${item.action}${c.reset}`);
                console.log();
            }
        }

        if (high.length > 0) {
            console.log(`${c.red}${c.bold}  ⚠️  ${high.length} 件の HIGH 影響があります — 修正が必要です${c.reset}\n`);
        } else if (medium.length > 0) {
            console.log(`${c.yellow}  ⚡ HIGH 影響はありません。${medium.length} 件の MEDIUM 影響を確認してください${c.reset}\n`);
        } else {
            console.log(`${c.green}  ✅ 影響は小さいです。必要に応じて新機能を取り込んでください${c.reset}\n`);
        }
    } else {
        console.log(`${c.green}  ✅ SDK への影響はありません${c.reset}\n`);
    }
}

// ═══════════════════════════════════════════════════════════════
// 6. CLI エントリポイント
// ═══════════════════════════════════════════════════════════════

function parseArgs(): { oldFiles: string[]; newFiles: string[] } {
    const args = process.argv.slice(2);
    const oldFiles: string[] = [];
    const newFiles: string[] = [];
    let current: string[] | null = null;

    for (const arg of args) {
        if (arg === "--old") { current = oldFiles; continue; }
        if (arg === "--new") { current = newFiles; continue; }
        if (arg === "--help" || arg === "-h") {
            console.log(`
Usage: npx tsx scripts/proto_diff.ts --old <files...> --new <files...>

Options:
  --old   旧バージョンの JS ファイル (複数可)
  --new   新バージョンの JS ファイル (複数可)

Example:
  npx tsx scripts/proto_diff.ts \\
    --old media_chat_formatted.old.js extension_formatted.old.js \\
    --new media_chat_formatted.js extension_formatted.js
`);
            process.exit(0);
        }
        if (current) {
            current.push(path.resolve(arg));
        }
    }

    if (oldFiles.length === 0 || newFiles.length === 0) {
        console.error("Error: --old と --new の両方にファイルを指定してください。");
        console.error("Usage: npx tsx scripts/proto_diff.ts --old <files...> --new <files...>");
        process.exit(1);
    }

    return { oldFiles, newFiles };
}

async function main() {
    const { oldFiles, newFiles } = parseArgs();

    console.log("📖 Old schema を解析中...");
    for (const f of oldFiles) console.log(`   ${f}`);
    const oldSchema = parseJsFiles(oldFiles);
    console.log(`   → ${oldSchema.messages.size} messages, ${oldSchema.enums.size} enums, ${oldSchema.services.size} services`);

    console.log("\n📖 New schema を解析中...");
    for (const f of newFiles) console.log(`   ${f}`);
    const newSchema = parseJsFiles(newFiles);
    console.log(`   → ${newSchema.messages.size} messages, ${newSchema.enums.size} enums, ${newSchema.services.size} services`);

    const diff = computeDiff(oldSchema, newSchema);
    const impacts = analyzeImpact(diff, newSchema);

    printDiff(diff, impacts);
}

main().catch(console.error);
