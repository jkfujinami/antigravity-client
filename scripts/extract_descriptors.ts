#!/usr/bin/env npx tsx
/**
 * extract_descriptors.ts — Antigravity Protobuf Descriptor Extraction Engine
 *
 * JS バンドルに埋め込まれた FileDescriptorProto (Base64) を抽出し、
 * .proto テキストを復元する。generate_from_js.ts の後継。
 *
 * 使い方:
 *   npx tsx scripts/extract_descriptors.ts extract [--output <dir>]
 *   npx tsx scripts/extract_descriptors.ts dump --filter <name>
 *   npx tsx scripts/extract_descriptors.ts summary
 *   npx tsx scripts/extract_descriptors.ts diff --old <dir> --new <dir>
 */

import * as fs from "fs";
import * as path from "path";
import { FileDescriptorProto } from "@bufbuild/protobuf";
import { extractDescriptors, printExtractionSummary } from "./lib/extractor";
import {
    buildKnownTypes,
    buildTypeToFile,
    renderProtoFile,
    shouldSkip,
} from "./lib/proto_printer";

// ═══════════════════════════════════════════════════════════════
// メイン
// ═══════════════════════════════════════════════════════════════

function main() {
    const args = process.argv.slice(2);
    const command = args[0] || "extract";

    switch (command) {
        case "extract":
            return cmdExtract(args);
        case "dump":
            return cmdDump(args);
        case "summary":
            return cmdSummary();
        case "diff":
            return cmdDiff(args);
        default:
            printUsage();
            process.exit(1);
    }
}

function printUsage() {
    console.log(`Usage: extract_descriptors.ts <command> [options]

Commands:
  extract [--output <dir>]         Extract all .proto files from bundles
  dump --filter <name>             Dump specific definitions matching filter
  summary                          Show extraction summary
  diff --old <dir> --new <dir>     Diff two sets of extracted .proto files
`);
}

// ═══════════════════════════════════════════════════════════════
// ディスクリプタ収集（複数バンドル対応）
// ═══════════════════════════════════════════════════════════════

function collectAllDescriptors(): Map<string, InstanceType<typeof FileDescriptorProto>> {
    const bundlePaths = [
        path.resolve(__dirname, "../resource/extension_formatted.js"),
        path.resolve(__dirname, "../resource/chat_formatted.js"),
    ];

    const allDescriptors = new Map<string, InstanceType<typeof FileDescriptorProto>>();

    for (const bundlePath of bundlePaths) {
        if (!fs.existsSync(bundlePath)) {
            console.log(`  skip (not found): ${path.basename(bundlePath)}`);
            continue;
        }

        console.log(`  scanning: ${path.basename(bundlePath)}`);
        const extracted = extractDescriptors(bundlePath);

        for (const d of extracted) {
            const name = d.proto.name;
            if (name && d.proto.package) {
                // 重複時はメッセージ数が多い方を採用
                const existing = allDescriptors.get(name);
                if (!existing || d.proto.messageType.length > existing.messageType.length) {
                    allDescriptors.set(name, d.proto);
                }
            }
        }
    }

    return allDescriptors;
}

// ═══════════════════════════════════════════════════════════════
// extract コマンド
// ═══════════════════════════════════════════════════════════════

function cmdExtract(args: string[]) {
    const outputDir = getArg(args, "--output")
        || path.resolve(__dirname, "../src/proto_generated");

    console.log("Collecting descriptors...");
    const descriptors = collectAllDescriptors();
    console.log(`\nFound ${descriptors.size} descriptors.\n`);

    // 既知の型とファイルマッピングを構築
    const knownTypes = buildKnownTypes(descriptors);
    const typeToFile = buildTypeToFile(descriptors);
    console.log(`Known types: ${knownTypes.size}`);

    // 出力ディレクトリを準備
    fs.mkdirSync(outputDir, { recursive: true });

    let fileCount = 0;
    for (const [filename, desc] of descriptors) {
        const pkg = desc.package || "";
        if (shouldSkip(pkg)) continue;

        const protoText = renderProtoFile(desc, filename, knownTypes, typeToFile);

        // ファイルパスは FileDescriptorProto.name をそのまま使用
        let relPath = filename;
        if (!relPath.endsWith(".proto")) relPath += ".proto";
        const filePath = path.join(outputDir, relPath);

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, protoText, "utf8");
        console.log(`  wrote: ${relPath}`);
        fileCount++;
    }

    console.log(`\nDone: ${fileCount} .proto files → ${outputDir}`);
}

// ═══════════════════════════════════════════════════════════════
// dump コマンド
// ═══════════════════════════════════════════════════════════════

function cmdDump(args: string[]) {
    const filter = getArg(args, "--filter");
    if (!filter) {
        console.error("--filter <name> is required for dump command");
        process.exit(1);
    }

    console.log("Collecting descriptors...");
    const descriptors = collectAllDescriptors();
    const knownTypes = buildKnownTypes(descriptors);

    console.log(`\nSearching for "${filter}"...\n`);

    for (const [, desc] of descriptors) {
        const pkg = desc.package || "";

        // メッセージ検索
        const searchMessages = (msgs: any[], prefix: string) => {
            for (const m of msgs) {
                const fullName = prefix + "." + m.name;
                if (fullName.includes(filter) || m.name.includes(filter)) {
                    dumpMessage(m, fullName, "", pkg, knownTypes);
                }
                if (m.nestedType) searchMessages(m.nestedType, fullName);
            }
        };
        searchMessages(desc.messageType as any[], pkg);

        // サービス検索
        for (const s of desc.service) {
            const fullName = pkg + "." + s.name;
            if (fullName.includes(filter) || s.name.includes(filter)) {
                console.log(`service ${fullName} {`);
                for (const m of s.method) {
                    const inType = resolveForDump(m.inputType);
                    const outType = resolveForDump(m.outputType);
                    const si = m.clientStreaming ? "stream " : "";
                    const so = m.serverStreaming ? "stream " : "";
                    console.log(`  rpc ${m.name}(${si}${inType}) returns (${so}${outType});`);
                }
                console.log(`}\n`);
            }
        }

        // Enum 検索
        for (const e of desc.enumType) {
            const fullName = pkg + "." + e.name;
            if (fullName.includes(filter) || e.name.includes(filter)) {
                console.log(`enum ${fullName} {`);
                for (const v of e.value) {
                    console.log(`  ${v.name} = ${v.number};`);
                }
                console.log(`}\n`);
            }
        }
    }
}

function dumpMessage(m: any, fullName: string, indent: string, pkg: string, knownTypes: Set<string>) {
    console.log(`${indent}message ${fullName} {`);

    if (m.enumType) {
        for (const e of m.enumType) {
            console.log(`${indent}  enum ${e.name} {`);
            for (const v of e.value) {
                console.log(`${indent}    ${v.name} = ${v.number};`);
            }
            console.log(`${indent}  }`);
        }
    }

    if (m.nestedType) {
        for (const sub of m.nestedType) {
            dumpMessage(sub, fullName + "." + sub.name, indent + "  ", pkg, knownTypes);
        }
    }

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

    for (const f of regularFields) {
        const label = f.label === 3 ? "repeated " : "";
        const t = resolveForDump(f.typeName) || SCALAR_MAP[f.type] || `unknown(${f.type})`;
        console.log(`${indent}  ${label}${t} ${f.name} = ${f.number};`);
    }

    for (const [idx, fields] of fieldsByOneof) {
        console.log(`${indent}  oneof ${oneofDecls[idx].name} {`);
        for (const f of fields) {
            const t = resolveForDump(f.typeName) || SCALAR_MAP[f.type] || `unknown(${f.type})`;
            console.log(`${indent}    ${t} ${f.name} = ${f.number};`);
        }
        console.log(`${indent}  }`);
    }

    console.log(`${indent}}\n`);
}

const SCALAR_MAP: Record<number, string> = {
    1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32",
    6: "fixed64", 7: "fixed32", 8: "bool", 9: "string",
    12: "bytes", 13: "uint32", 15: "sfixed32", 16: "sfixed64",
    17: "sint32", 18: "sint64",
};

function resolveForDump(typeName: string | undefined): string {
    if (!typeName) return "";
    return typeName.startsWith(".") ? typeName.substring(1) : typeName;
}

// ═══════════════════════════════════════════════════════════════
// summary コマンド
// ═══════════════════════════════════════════════════════════════

function cmdSummary() {
    console.log("Collecting descriptors...");
    const descriptors = collectAllDescriptors();

    let totalMsgs = 0, totalEnums = 0, totalSvcs = 0, totalMethods = 0;

    console.log(`\n── ${descriptors.size} descriptors ──\n`);
    for (const [name, d] of descriptors) {
        const msgs = d.messageType.length;
        const enums = d.enumType.length;
        const svcs = d.service.length;
        const methods = d.service.reduce((n, s) => n + s.method.length, 0);
        totalMsgs += msgs;
        totalEnums += enums;
        totalSvcs += svcs;
        totalMethods += methods;

        const svcTag = svcs > 0 ? ` [SVC:${svcs} RPCs:${methods}]` : "";
        console.log(`  ${name}  msgs:${msgs} enums:${enums}${svcTag}`);
    }

    console.log(`\nTotal: ${totalMsgs} messages, ${totalEnums} enums, ${totalSvcs} services, ${totalMethods} RPCs`);
}

// ═══════════════════════════════════════════════════════════════
// diff コマンド
// ═══════════════════════════════════════════════════════════════

function cmdDiff(args: string[]) {
    const oldDir = getArg(args, "--old");
    const newDir = getArg(args, "--new");

    if (!oldDir || !newDir) {
        console.error("Usage: diff --old <dir> --new <dir>");
        process.exit(1);
    }

    const oldFiles = collectProtoFiles(oldDir);
    const newFiles = collectProtoFiles(newDir);

    const allNames = new Set([...oldFiles.keys(), ...newFiles.keys()]);

    let added = 0, removed = 0, changed = 0, unchanged = 0;

    console.log("\n═══ Proto Schema Diff ═══\n");

    for (const name of [...allNames].sort()) {
        const oldContent = oldFiles.get(name);
        const newContent = newFiles.get(name);

        if (!oldContent && newContent) {
            console.log(`  [NEW]     ${name}`);
            added++;
        } else if (oldContent && !newContent) {
            console.log(`  [REMOVED] ${name}`);
            removed++;
        } else if (oldContent && newContent) {
            if (oldContent === newContent) {
                unchanged++;
            } else {
                // 行レベルの差分をカウント
                const oldLines = oldContent.split("\n");
                const newLines = newContent.split("\n");
                const addedLines = newLines.filter(l => !oldLines.includes(l));
                const removedLines = oldLines.filter(l => !newLines.includes(l));

                console.log(`  [CHANGED] ${name}  (+${addedLines.length} -${removedLines.length} lines)`);

                // 重要な変更を表示
                for (const line of addedLines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("rpc ") || trimmed.startsWith("message ") || trimmed.startsWith("enum ")) {
                        console.log(`    + ${trimmed}`);
                    }
                }
                for (const line of removedLines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith("rpc ") || trimmed.startsWith("message ") || trimmed.startsWith("enum ")) {
                        console.log(`    - ${trimmed}`);
                    }
                }

                changed++;
            }
        }
    }

    console.log(`\n── Summary ──`);
    console.log(`  New files:       ${added}`);
    console.log(`  Removed files:   ${removed}`);
    console.log(`  Changed files:   ${changed}`);
    console.log(`  Unchanged files: ${unchanged}`);
}

function collectProtoFiles(dir: string): Map<string, string> {
    const files = new Map<string, string>();

    function walk(d: string) {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name.endsWith(".proto")) {
                const rel = path.relative(dir, full);
                files.set(rel, fs.readFileSync(full, "utf8"));
            }
        }
    }

    if (fs.existsSync(dir)) walk(dir);
    return files;
}

// ═══════════════════════════════════════════════════════════════
// ユーティリティ
// ═══════════════════════════════════════════════════════════════

function getArg(args: string[], flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

main();
