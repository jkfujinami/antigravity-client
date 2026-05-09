/**
 * Phase 4: FileDescriptorProto → .proto テキスト 直接レンダリング
 *
 * ParsedSchema を経由せず、FileDescriptorProto の構造をそのまま走査して
 * .proto テキストを生成する。ネスト構造・map フィールド・oneof・import を
 * 正確に再現する。
 */

import { FileDescriptorProto } from "@bufbuild/protobuf";

const SCALAR_TYPE_MAP: Record<number, string> = {
    1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32",
    6: "fixed64", 7: "fixed32", 8: "bool", 9: "string",
    12: "bytes", 13: "uint32", 15: "sfixed32", 16: "sfixed64",
    17: "sint32", 18: "sint64",
};

const SKIP_PACKAGES = new Set([
    "google.protobuf", "google.rpc", "google.type", "google.api", "pb",
]);

/**
 * 型名を解決する。
 * knownTypes に存在しない外部型は bytes にフォールバック。
 */
function resolveType(
    typeId: number,
    typeName: string | undefined,
    selfPkg: string,
    knownTypes: Set<string>,
): string {
    if (typeId === 11 || typeId === 14) {
        if (!typeName) return "bytes";
        const fqn = typeName.startsWith(".") ? typeName.substring(1) : typeName;

        // 同一パッケージ内は常に OK
        if (fqn.startsWith(selfPkg + ".")) return fqn;

        // 既知の型で、スキップ対象パッケージに属さないものは OK
        if (knownTypes.has(fqn)) {
            const typePkg = fqn.substring(0, fqn.lastIndexOf("."));
            if (!SKIP_PACKAGES.has(typePkg)) return fqn;
        }

        // Google WKT は完全修飾名で返す（import は生成しない）
        if (fqn.startsWith("google.protobuf.")) return fqn;
        if (fqn.startsWith("google.rpc.")) return fqn;

        // 未知型 → bytes フォールバック
        return "bytes";
    }
    return SCALAR_TYPE_MAP[typeId] || "string";
}

/**
 * 全ディスクリプタから既知の型名セットを構築する。
 */
export function buildKnownTypes(
    descriptors: Map<string, InstanceType<typeof FileDescriptorProto>>
): Set<string> {
    const known = new Set<string>();

    for (const [, d] of descriptors) {
        if (!d.package) continue;
        collectTypes(d.messageType as any[], d.package, known);
        for (const e of d.enumType) {
            known.add(d.package + "." + e.name);
        }
    }

    return known;
}

function collectTypes(msgs: any[], prefix: string, out: Set<string>): void {
    for (const m of msgs) {
        const fullName = prefix + "." + m.name;
        out.add(fullName);
        if (m.nestedType) collectTypes(m.nestedType, fullName, out);
        if (m.enumType) {
            for (const e of m.enumType) {
                out.add(fullName + "." + e.name);
            }
        }
    }
}

/**
 * 型名 → ファイル名マッピングを構築する（import 解決用）。
 */
export function buildTypeToFile(
    descriptors: Map<string, InstanceType<typeof FileDescriptorProto>>
): Map<string, string> {
    const map = new Map<string, string>();

    for (const [fname, d] of descriptors) {
        if (!d.package) continue;

        const addTypes = (msgs: any[], prefix: string) => {
            for (const m of msgs) {
                const fqn = prefix + "." + m.name;
                map.set(fqn, fname);
                if (m.nestedType) addTypes(m.nestedType, fqn);
                if (m.enumType) {
                    for (const e of m.enumType) map.set(fqn + "." + e.name, fname);
                }
            }
        };

        addTypes(d.messageType as any[], d.package);
        for (const e of d.enumType) {
            map.set(d.package + "." + e.name, fname);
        }
    }

    return map;
}

/**
 * 単一の FileDescriptorProto から .proto テキストを生成する。
 */
export function renderProtoFile(
    desc: InstanceType<typeof FileDescriptorProto>,
    filename: string,
    knownTypes: Set<string>,
    typeToFile: Map<string, string>,
): string {
    const pkg = desc.package || "common";
    const lines: string[] = [];

    lines.push(`syntax = "proto3";`);
    lines.push(`package ${pkg};`);
    lines.push(``);

    // ── import 文の計算 ──
    const importFiles = new Set<string>();

    const scanFieldImports = (msgs: any[]) => {
        for (const m of msgs) {
            if (m.field) {
                for (const f of m.field) {
                    if ((f.type === 11 || f.type === 14) && f.typeName) {
                        const fqn = f.typeName.startsWith(".")
                            ? f.typeName.substring(1) : f.typeName;
                        if (knownTypes.has(fqn)) {
                            const typeFile = typeToFile.get(fqn);
                            const typePkg = fqn.substring(0, fqn.lastIndexOf("."));
                            if (typeFile && typeFile !== filename && !SKIP_PACKAGES.has(typePkg)) {
                                importFiles.add(typeFile);
                            }
                        }
                    }
                }
            }
            if (m.nestedType) scanFieldImports(m.nestedType);
        }
    };

    scanFieldImports(desc.messageType as any[]);

    // サービスのメソッドからも import を収集
    for (const s of desc.service) {
        if (s.method) {
            for (const m of s.method) {
                for (const typeName of [m.inputType, m.outputType]) {
                    if (!typeName) continue;
                    const fqn = typeName.startsWith(".") ? typeName.substring(1) : typeName;
                    if (knownTypes.has(fqn)) {
                        const typeFile = typeToFile.get(fqn);
                        const typePkg = fqn.substring(0, fqn.lastIndexOf("."));
                        if (typeFile && typeFile !== filename && !SKIP_PACKAGES.has(typePkg)) {
                            importFiles.add(typeFile);
                        }
                    }
                }
            }
        }
    }

    const imports = Array.from(importFiles).sort();
    for (const imp of imports) {
        lines.push(`import "${imp}";`);
    }
    if (imports.length > 0) lines.push("");

    // ── トップレベル Enum ──
    for (const e of desc.enumType) {
        lines.push(`enum ${e.name} {`);
        for (const v of e.value) {
            lines.push(`  ${v.name} = ${v.number};`);
        }
        lines.push(`}`);
        lines.push("");
    }

    // ── メッセージ（再帰、ネスト保持） ──
    for (const m of desc.messageType as any[]) {
        renderMessage(m, "", pkg, knownTypes, lines);
    }

    // ── サービス ──
    for (const s of desc.service) {
        lines.push(`service ${s.name} {`);
        for (const m of s.method) {
            const inType = resolveType(11, m.inputType, pkg, knownTypes);
            const outType = resolveType(11, m.outputType, pkg, knownTypes);
            const inStream = m.clientStreaming ? "stream " : "";
            const outStream = m.serverStreaming ? "stream " : "";
            lines.push(`  rpc ${m.name}(${inStream}${inType}) returns (${outStream}${outType});`);
        }
        lines.push(`}`);
        lines.push("");
    }

    return lines.join("\n");
}

function renderMessage(
    m: any,
    indent: string,
    pkg: string,
    knownTypes: Set<string>,
    lines: string[],
): void {
    lines.push(`${indent}message ${m.name} {`);

    // ネストされた Enum
    if (m.enumType) {
        for (const e of m.enumType) {
            lines.push(`${indent}  enum ${e.name} {`);
            for (const v of e.value) {
                lines.push(`${indent}    ${v.name} = ${v.number};`);
            }
            lines.push(`${indent}  }`);
            lines.push("");
        }
    }

    // ネストされたメッセージ（再帰）
    if (m.nestedType) {
        for (const subM of m.nestedType) {
            renderMessage(subM, indent + "  ", pkg, knownTypes, lines);
        }
    }

    // oneof グループの分離
    const oneofDecls: any[] = m.oneofDecl || [];
    const fieldsByOneof = new Map<number, any[]>();
    const regularFields: any[] = [];

    if (m.field) {
        for (const f of m.field) {
            if (f.oneofIndex !== undefined && f.oneofIndex !== null && !f.proto3Optional) {
                if (!fieldsByOneof.has(f.oneofIndex)) fieldsByOneof.set(f.oneofIndex, []);
                fieldsByOneof.get(f.oneofIndex)!.push(f);
            } else {
                regularFields.push(f);
            }
        }
    }

    // 通常フィールド
    for (const f of regularFields) {
        renderField(f, indent + "  ", pkg, knownTypes, lines);
    }

    // oneof フィールド
    for (const [idx, fields] of fieldsByOneof) {
        lines.push(`${indent}  oneof ${oneofDecls[idx].name} {`);
        for (const f of fields) {
            renderField(f, indent + "    ", pkg, knownTypes, lines);
        }
        lines.push(`${indent}  }`);
    }

    lines.push(`${indent}}`);
    lines.push("");
}

function renderField(
    f: any,
    indent: string,
    pkg: string,
    knownTypes: Set<string>,
    lines: string[],
): void {
    const label = f.label === 3 ? "repeated " : "";
    const typeStr = resolveType(f.type, f.typeName, pkg, knownTypes);
    lines.push(`${indent}${label}${typeStr} ${f.name} = ${f.number};`);
}

/**
 * パッケージがスキップ対象かどうかを判定する。
 */
export function shouldSkip(pkg: string): boolean {
    return SKIP_PACKAGES.has(pkg);
}
