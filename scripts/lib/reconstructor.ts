/**
 * Phase 3: FileDescriptorProto → ParsedSchema 変換
 *
 * FileDescriptorProto の構造を走査し、
 * 旧 proto_diff.ts の ParsedSchema 互換の構造に変換する。
 */

import {
    FileDescriptorProto,
    DescriptorProto,
    EnumDescriptorProto,
    FieldDescriptorProto,
    FieldDescriptorProto_Type,
    FieldDescriptorProto_Label,
    ServiceDescriptorProto,
    MethodDescriptorProto,
} from "@bufbuild/protobuf";

import type { ExtractedDescriptor } from "./extractor";

// ═══════════════════════════════════════════════════════════════
// 型定義（旧 proto_diff.ts 互換）
// ═══════════════════════════════════════════════════════════════

export interface FieldDef {
    no: number;
    name: string;
    /** proto型名: "string", "int32", "bool", ".exa.cortex_pb.CascadeConfig" 等 */
    typeName: string;
    repeated: boolean;
    optional: boolean;
    mapKey?: string;
    mapValue?: string;
    oneofName?: string;
}

export interface MessageDef {
    fullName: string;
    fields: FieldDef[];
    nestedMessages: string[];
    nestedEnums: string[];
}

export interface EnumValueDef {
    name: string;
    number: number;
}

export interface EnumDef {
    fullName: string;
    values: EnumValueDef[];
}

export interface MethodDef {
    name: string;
    inputType: string;
    outputType: string;
    clientStreaming: boolean;
    serverStreaming: boolean;
}

export interface ServiceDef {
    fullName: string;
    methods: MethodDef[];
}

export interface ParsedSchema {
    messages: Map<string, MessageDef>;
    enums: Map<string, EnumDef>;
    services: Map<string, ServiceDef>;
    /** proto ファイル名 → パッケージ名 */
    files: Map<string, string>;
}

// ═══════════════════════════════════════════════════════════════
// スカラー型マッピング
// ═══════════════════════════════════════════════════════════════

const SCALAR_TYPE_MAP: Record<number, string> = {
    [FieldDescriptorProto_Type.DOUBLE]:   "double",
    [FieldDescriptorProto_Type.FLOAT]:    "float",
    [FieldDescriptorProto_Type.INT64]:    "int64",
    [FieldDescriptorProto_Type.UINT64]:   "uint64",
    [FieldDescriptorProto_Type.INT32]:    "int32",
    [FieldDescriptorProto_Type.FIXED64]:  "fixed64",
    [FieldDescriptorProto_Type.FIXED32]:  "fixed32",
    [FieldDescriptorProto_Type.BOOL]:     "bool",
    [FieldDescriptorProto_Type.STRING]:   "string",
    [FieldDescriptorProto_Type.BYTES]:    "bytes",
    [FieldDescriptorProto_Type.UINT32]:   "uint32",
    [FieldDescriptorProto_Type.SFIXED32]: "sfixed32",
    [FieldDescriptorProto_Type.SFIXED64]: "sfixed64",
    [FieldDescriptorProto_Type.SINT32]:   "sint32",
    [FieldDescriptorProto_Type.SINT64]:   "sint64",
};

// ═══════════════════════════════════════════════════════════════
// メイン変換関数
// ═══════════════════════════════════════════════════════════════

/**
 * 複数の ExtractedDescriptor から ParsedSchema を構築する。
 */
export function reconstruct(descriptors: ExtractedDescriptor[]): ParsedSchema {
    const schema: ParsedSchema = {
        messages: new Map(),
        enums: new Map(),
        services: new Map(),
        files: new Map(),
    };

    for (const d of descriptors) {
        const fdp = d.proto;
        const pkg = fdp.package || "";

        schema.files.set(fdp.name || "", pkg);

        // トップレベルメッセージ
        for (const msg of fdp.messageType) {
            processMessage(msg, pkg, schema);
        }

        // トップレベル Enum
        for (const enumDef of fdp.enumType) {
            processEnum(enumDef, pkg, schema);
        }

        // サービス
        for (const svc of fdp.service) {
            processService(svc, pkg, schema);
        }
    }

    return schema;
}

// ═══════════════════════════════════════════════════════════════
// 内部処理
// ═══════════════════════════════════════════════════════════════

function processMessage(
    msg: InstanceType<typeof DescriptorProto>,
    parentPrefix: string,
    schema: ParsedSchema
): void {
    const msgName = msg.name || "";
    const fullName = parentPrefix ? `${parentPrefix}.${msgName}` : msgName;

    // map entry かどうかの判定
    const isMapEntry = msg.options?.mapEntry === true;
    if (isMapEntry) return; // map entry 自体は独立したメッセージとして登録しない

    // ネストされたメッセージのうち map entry を収集（フィールド変換時に使う）
    const mapEntries = new Map<string, InstanceType<typeof DescriptorProto>>();
    for (const nested of msg.nestedType) {
        if (nested.options?.mapEntry === true) {
            mapEntries.set(`.${fullName}.${nested.name || ""}`, nested);
        }
    }

    // oneof 名のマッピング
    const oneofNames: string[] = msg.oneofDecl.map(o => o.name || "");

    // フィールドを変換
    const fields: FieldDef[] = [];
    for (const f of msg.field) {
        const fd = convertField(f, oneofNames, mapEntries);
        if (fd) fields.push(fd);
    }

    const nestedMessages: string[] = [];
    const nestedEnums: string[] = [];

    // ネストされたメッセージを再帰処理
    for (const nested of msg.nestedType) {
        if (nested.options?.mapEntry === true) continue;
        const nestedFullName = `${fullName}.${nested.name || ""}`;
        nestedMessages.push(nestedFullName);
        processMessage(nested, fullName, schema);
    }

    // ネストされた Enum
    for (const nested of msg.enumType) {
        const nestedFullName = `${fullName}.${nested.name || ""}`;
        nestedEnums.push(nestedFullName);
        processEnum(nested, fullName, schema);
    }

    schema.messages.set(fullName, {
        fullName,
        fields,
        nestedMessages,
        nestedEnums,
    });
}

function convertField(
    f: InstanceType<typeof FieldDescriptorProto>,
    oneofNames: string[],
    mapEntries: Map<string, InstanceType<typeof DescriptorProto>>
): FieldDef | null {
    const no = f.number || 0;
    const name = f.name || "";
    const repeated = f.label === FieldDescriptorProto_Label.REPEATED;

    // map フィールドの検出
    if (repeated && f.type === FieldDescriptorProto_Type.MESSAGE && f.typeName) {
        const entry = mapEntries.get(f.typeName);
        if (entry && entry.field.length === 2) {
            const keyField = entry.field.find(e => e.name === "key");
            const valueField = entry.field.find(e => e.name === "value");
            if (keyField && valueField) {
                return {
                    no,
                    name,
                    typeName: `map<${resolveTypeName(keyField)}, ${resolveTypeName(valueField)}>`,
                    repeated: false,
                    optional: false,
                    mapKey: resolveTypeName(keyField),
                    mapValue: resolveTypeName(valueField),
                };
            }
        }
    }

    // 通常のフィールド
    const typeName = resolveTypeName(f);

    // optional 判定: proto3 では oneof に属していない explicit optional は
    // oneofIndex が設定されるが、synthetic oneof として扱われる
    const hasOneofIndex = f.oneofIndex !== undefined && f.oneofIndex >= 0;
    const oneofName = hasOneofIndex ? oneofNames[f.oneofIndex as number] : undefined;

    // proto3 の synthetic oneof (optional フィールド) の検出
    // synthetic oneof の名前は "_fieldname" のパターン
    const isSyntheticOneof = oneofName?.startsWith("_");
    const isOptional = isSyntheticOneof;
    const realOneofName = hasOneofIndex && !isSyntheticOneof ? oneofName : undefined;

    return {
        no,
        name,
        typeName,
        repeated,
        optional: isOptional || false,
        oneofName: realOneofName,
    };
}

function resolveTypeName(f: InstanceType<typeof FieldDescriptorProto>): string {
    // message / enum 参照の場合
    if (
        (f.type === FieldDescriptorProto_Type.MESSAGE ||
         f.type === FieldDescriptorProto_Type.ENUM) &&
        f.typeName
    ) {
        return f.typeName;
    }

    // スカラー型
    return SCALAR_TYPE_MAP[f.type as number] || `unknown(${f.type})`;
}

function processEnum(
    enumDef: InstanceType<typeof EnumDescriptorProto>,
    parentPrefix: string,
    schema: ParsedSchema
): void {
    const enumDefName = enumDef.name || "";
    const fullName = parentPrefix ? `${parentPrefix}.${enumDefName}` : enumDefName;

    const values: EnumValueDef[] = enumDef.value.map(v => ({
        name: v.name || "",
        number: v.number || 0,
    }));

    schema.enums.set(fullName, { fullName, values });
}

function processService(
    svc: InstanceType<typeof ServiceDescriptorProto>,
    parentPrefix: string,
    schema: ParsedSchema
): void {
    const svcName = svc.name || "";
    const fullName = parentPrefix ? `${parentPrefix}.${svcName}` : svcName;

    const methods: MethodDef[] = svc.method.map((m: InstanceType<typeof MethodDescriptorProto>) => ({
        name: m.name || "",
        inputType: m.inputType || "",
        outputType: m.outputType || "",
        clientStreaming: m.clientStreaming || false,
        serverStreaming: m.serverStreaming || false,
    }));

    schema.services.set(fullName, { fullName, methods });
}
