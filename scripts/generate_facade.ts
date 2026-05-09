#!/usr/bin/env npx tsx
/**
 * generate_facade.ts — The "Actually Zero Error" Version
 */

import * as fs from "fs";
import * as path from "path";
import { MethodKind } from "@bufbuild/protobuf";
import { LanguageServerService } from "../src/gen/exa/language_server_pb/language_server_connect.js";
import { extractDescriptors } from "./lib/extractor.js";

const EXCLUDED_FIELDS = new Set(["metadata"]);
const FACADE_ROOT = path.resolve(__dirname, "../src/facade");
const GEN_ROOT = path.resolve(__dirname, "../src/gen");

const SCALAR_TS: Record<number, string> = {
    1: "number", 2: "number", 3: "bigint", 4: "bigint", 5: "number",
    6: "bigint", 7: "number", 8: "boolean", 9: "string",
    12: "Uint8Array", 13: "number", 15: "number", 16: "bigint",
    17: "number", 18: "number",
};

const typeToPkg = new Map<string, string>();
const typeToFile = new Map<string, string>();
const fileToEnums = new Map<string, Set<string>>();

function buildTypeMaps() {
    const bundlePaths = [path.resolve(__dirname, "../resource/extension_formatted.js"), path.resolve(__dirname, "../resource/chat_formatted.js")];
    // 全ファイルを先にリストアップ
    const allGenFiles: string[] = [];
    const walk = (d: string) => {
        if (!fs.existsSync(d)) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) walk(f);
            else if (e.name.endsWith(".ts") && !e.name.endsWith("_connect.ts")) allGenFiles.push(f);
        }
    };
    walk(GEN_ROOT);

    for (const b of bundlePaths) {
        if (!fs.existsSync(b)) continue;
        for (const d of extractDescriptors(b)) {
            const pkg = d.proto.package || "";
            // 真実のファイルパス: .proto の名前から導出
            const protoName = d.proto.name || "";
            const relFile = protoName.replace(/\.proto$/, "_pb.ts");
            const foundFile = allGenFiles.find(f => f.endsWith(relFile));
            const finalRel = foundFile ? path.relative(GEN_ROOT, foundFile) : relFile;

            const scan = (msgs: any[], prefix: string) => {
                for (const m of msgs) {
                    const full = prefix ? `${prefix}.${m.name}` : m.name;
                    typeToPkg.set(full, pkg);
                    typeToFile.set(full, finalRel);
                    if (m.nestedType) scan(m.nestedType, full);
                    if (m.enumType) for (const e of m.enumType) {
                        const ef = `${full}.${e.name}`;
                        typeToPkg.set(ef, pkg);
                        typeToFile.set(ef, finalRel);
                    }
                }
            };
            scan(d.proto.messageType as any[], pkg);
            if (d.proto.enumType) for (const e of d.proto.enumType as any[]) {
                const ef = pkg ? `${pkg}.${e.name}` : e.name;
                typeToPkg.set(ef, pkg);
                typeToFile.set(ef, finalRel);
            }
        }
    }
}

function scanGenExports() {
    for (const f of typeToFile.values()) {
        if (!f) continue;
        const full = path.join(GEN_ROOT, f);
        if (!fs.existsSync(full)) continue;
        const content = fs.readFileSync(full, "utf8");
        const matches = content.matchAll(/export\s+(?:declare\s+)?(?:enum|const|class)\s+(\w+)/g);
        if (!fileToEnums.has(f)) fileToEnums.set(f, new Set());
        for (const m of matches) fileToEnums.get(f)!.add(m[1]);
    }
}

function getExportName(typeName: string): string {
    const pkg = typeToPkg.get(typeName);
    const file = typeToFile.get(typeName);
    if (!pkg || !file) return typeName.split(".").pop()!;
    const subName = typeName.substring(pkg.length + 1);
    const candidate = subName.replace(/\./g, "_");
    const exported = fileToEnums.get(file);
    return (exported && exported.has(candidate)) ? candidate : typeName.split(".").pop()!;
}

interface MsgOut { typeName: string; inputName: string; targetFile: string; fields: any[] }
const messages = new Map<string, MsgOut>();
const usedEnums = new Set<string>();
const usedInputNames = new Map<string, string>(); // inputName -> typeName

function discover(cls: any) {
    const tn = cls?.typeName;
    if (!tn || messages.has(tn)) return;
    
    const rawName = getExportName(tn) + "Input";
    let inputName = rawName;
    if (usedInputNames.has(inputName) && usedInputNames.get(inputName) !== tn) {
        const p = tn.split(".");
        const prefix = p[p.length - 2]?.replace("_pb", "") || "Alt";
        inputName = (prefix.charAt(0).toUpperCase() + prefix.slice(1)) + rawName;
    }
    usedInputNames.set(inputName, tn);

    const file = typeToFile.get(tn) || "misc.ts";
    const msg: MsgOut = { typeName: tn, inputName, targetFile: file, fields: [] };
    messages.set(tn, msg); // 循環参照回避のため先にセット

    if (cls.fields?.list) {
        for (const f of cls.fields.list()) {
            if (EXCLUDED_FIELDS.has(f.name)) continue;
            const { tsType, refs } = resolveType(f);
            msg.fields.push({
                name: f.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
                tsType: f.repeated ? `${tsType}[]` : tsType,
                refs
            });
        }
    }
}

function resolveType(f: any): { tsType: string; refs: string[] } {
    if (f.kind === "scalar") return { tsType: SCALAR_TS[f.T] || "any", refs: [] };
    if (f.kind === "enum") { usedEnums.add(f.T.typeName); return { tsType: getExportName(f.T.typeName), refs: [f.T.typeName] }; }
    if (f.kind === "message") { discover(f.T); return { tsType: messages.get(f.T.typeName)!.inputName, refs: [f.T.typeName] }; }
    if (f.kind === "map") {
        const k = SCALAR_TS[f.K] || "string";
        let v = "any", r: string[] = [];
        if (f.V.kind === "scalar") v = SCALAR_TS[f.V.T];
        else if (f.V.kind === "message") { discover(f.V.T); v = messages.get(f.V.T.typeName)!.inputName; r = [f.V.T.typeName]; }
        else if (f.V.kind === "enum") { usedEnums.add(f.V.T.typeName); v = getExportName(f.V.T.typeName); r = [f.V.T.typeName]; }
        return { tsType: `Record<${k}, ${v}>`, refs: r };
    }
    return { tsType: "any", refs: [] };
}

function generate() {
    const groups = new Map<string, MsgOut[]>();
    for (const m of messages.values()) {
        const f = m.targetFile;
        if (!groups.has(f)) groups.set(f, []);
        groups.get(f)!.push(m);
    }

    for (const [relPath, msgs] of groups) {
        const full = path.join(FACADE_ROOT, relPath);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        const imports = new Map<string, Map<string, string>>(); // path -> { originalName -> alias }

        for (const m of msgs) {
            for (const f of m.fields) {
                for (const r of f.refs) {
                    let name = "", targetPath = "";
                    if (messages.has(r)) {
                        const t = messages.get(r)!;
                        if (t.targetFile === relPath) continue;
                        name = t.inputName;
                        targetPath = path.relative(path.dirname(relPath), t.targetFile).replace(/\.ts$/, ".js");
                    } else if (usedEnums.has(r)) {
                        const file = typeToFile.get(r);
                        name = getExportName(r);
                        if (r.startsWith("google.protobuf")) {
                            targetPath = "@bufbuild/protobuf";
                        } else if (file) {
                            targetPath = path.relative(path.dirname(full), path.join(GEN_ROOT, file)).replace(/\.ts$/, ".js");
                        }
                    }
                    if (targetPath && name) {
                        if (!targetPath.startsWith(".") && targetPath !== "@bufbuild/protobuf") targetPath = "./" + targetPath;
                        if (!imports.has(targetPath)) imports.set(targetPath, new Map());
                        imports.get(targetPath)!.set(name, name);
                    }
                }
            }
        }

        // 衝突解決エイリアス
        const seenNames = new Map<string, string>(); // name -> path
        for (const [p, names] of imports) {
            for (const [n] of names) {
                if (seenNames.has(n) && seenNames.get(n) !== p) {
                    const alias = (p.split("/").slice(-2, -1)[0] || "Alt") + n;
                    names.set(n, alias);
                }
                seenNames.set(n, p);
            }
        }

        const out = [`// @generated by scripts/generate_facade.ts`, `// DO NOT EDIT MANUALLY`, ``];
        for (const [p, names] of [...imports.entries()].sort()) {
            const items = [...names.entries()].map(([n, a]) => n === a ? n : `${n} as ${a}`).sort();
            out.push(`import { ${items.join(", ")} } from "${p}";`);
        }
        if (imports.size > 0) out.push(``);

        // フィールド型名もエイリアスに置換
        for (const m of msgs.sort((a,b) => a.inputName.localeCompare(b.inputName))) {
            out.push(`export interface ${m.inputName} {`);
            for (const f of m.fields) {
                let finalType = f.tsType;
                for (const [p, names] of imports) {
                    for (const [n, a] of names) {
                        if (n !== a) finalType = finalType.replace(new RegExp(`\\b${n}\\b`, "g"), a);
                    }
                }
                out.push(`  ${f.name}?: ${finalType};`);
            }
            out.push(`}`);
            out.push(``);
        }
        fs.writeFileSync(full, out.join("\n"));
    }
}

function main() {
    console.log("=== Generating Facade (The Final Boss) ===\n");
    buildTypeMaps(); scanGenExports();
    for (const [, m] of Object.entries(LanguageServerService.methods) as any) {
        if (m.kind === MethodKind.Unary) { discover(m.I); discover(m.O); }
    }
    if (fs.existsSync(FACADE_ROOT)) fs.rmSync(FACADE_ROOT, { recursive: true });
    generate();
    console.log(`Successfully generated ${messages.size} interfaces.`);
}
main();
