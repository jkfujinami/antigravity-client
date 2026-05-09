#!/usr/bin/env npx tsx
/**
 * generate_facade.ts — The Definitive Working Version (Single File)
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

const SERVICES = [
    { name: "LanguageServer", service: LanguageServerService, relPath: "exa/language_server_pb/language_server_connect.js" }
];

const typeToPkg = new Map<string, string>();
const typeToFile = new Map<string, string>();
const fileToEnums = new Map<string, Set<string>>();

function buildTypeMaps() {
    const bundlePaths = [path.resolve(__dirname, "../resource/extension_formatted.js"), path.resolve(__dirname, "../resource/chat_formatted.js")];
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
const usedInputNames = new Map<string, string>(); 

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
    messages.set(tn, msg); 

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
    if (f.kind === "enum") { 
        usedEnums.add(f.T.typeName); 
        const name = getExportName(f.T.typeName);
        if (f.T.typeName.startsWith("google.")) return { tsType: "any", refs: [] };
        return { tsType: name, refs: [f.T.typeName] }; 
    }
    if (f.kind === "message") { 
        discover(f.T); 
        const name = messages.get(f.T.typeName)!.inputName;
        if (f.T.typeName.startsWith("google.")) return { tsType: "any", refs: [] };
        return { tsType: name, refs: [f.T.typeName] }; 
    }
    if (f.kind === "map") {
        const k = SCALAR_TS[f.K] || "string";
        let v = "any", r: string[] = [];
        if (f.V.kind === "scalar") v = SCALAR_TS[f.V.T];
        else if (f.V.kind === "message") { 
            if (f.V.T.typeName.startsWith("google.")) v = "any";
            else { discover(f.V.T); v = messages.get(f.V.T.typeName)!.inputName; r = [f.V.T.typeName]; }
        }
        else if (f.V.kind === "enum") { 
            if (f.V.T.typeName.startsWith("google.")) v = "any";
            else { usedEnums.add(f.V.T.typeName); v = getExportName(f.V.T.typeName); r = [f.V.T.typeName]; }
        }
        return { tsType: `Record<${k}, ${v}>`, refs: r };
    }
    return { tsType: "any", refs: [] };
}

function relPathToNamespace(relPath: string): string {
    const parts = relPath.replace(/\.ts$/, "").split("/");
    const rawName = parts[parts.length - 1].replace(/(_pb|_connect)$/, "");
    return rawName.split("_").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

function generate() {
    const out = [`// @generated by scripts/generate_facade.ts`, `// DO NOT EDIT MANUALLY`, ``, `/* eslint-disable */`, ``];

    const enumImports = new Map<string, Map<string, string>>();
    const seenEnumNames = new Map<string, string>();

    for (const tn of usedEnums) {
        if (tn.startsWith("google.")) continue;
        const file = typeToFile.get(tn);
        if (file) {
            const name = getExportName(tn);
            if (!enumImports.has(file)) enumImports.set(file, new Map());
            let alias = name;
            if (seenEnumNames.has(name) && seenEnumNames.get(name) !== file) {
                alias = `${relPathToNamespace(file)}${name}`;
            }
            seenEnumNames.set(name, file);
            enumImports.get(file)!.set(name, alias);
        }
    }

    for (const [f, namesMap] of enumImports) {
        const p = "../gen/" + f.replace(/\.ts$/, ".js");
        const items = [...namesMap.entries()].map(([orig, alias]) => orig === alias ? orig : `${orig} as ${alias}`).sort();
        out.push(`import { ${items.join(", ")} } from "${p}";`);
    }
    out.push(``);

    const sortedMsgs = [...messages.values()].sort((a,b) => a.inputName.localeCompare(b.inputName));
    for (const m of sortedMsgs) {
        if (m.typeName.startsWith("google.")) continue;
        out.push(`export interface ${m.inputName} {`);
        for (const f of m.fields) {
            let tsType = f.tsType;
            for (const tn of f.refs) {
                if (usedEnums.has(tn)) {
                    const file = typeToFile.get(tn);
                    const origName = getExportName(tn);
                    const alias = file ? enumImports.get(file)?.get(origName) : null;
                    if (alias) tsType = tsType.replace(new RegExp(`\\b${origName}\\b`, "g"), alias);
                }
            }
            out.push(`  ${f.name}?: ${tsType};`);
        }
        out.push(`}`);
        out.push(``);
    }
    fs.writeFileSync(path.join(FACADE_ROOT, "inputs.ts"), out.join("\n"));

    const indexLines = [
        `// @generated by scripts/generate_facade.ts`, `// DO NOT EDIT MANUALLY`, ``,
        `import * as Inputs from "./inputs.js";`, ``, `export namespace T {`
    ];

    const pkgToMsgs = new Map<string, MsgOut[]>();
    for (const m of messages.values()) {
        if (m.typeName.startsWith("google.")) continue;
        const ns = relPathToNamespace(m.targetFile);
        if (!pkgToMsgs.has(ns)) pkgToMsgs.set(ns, []);
        pkgToMsgs.get(ns)!.push(m);
    }

    for (const [ns, msgs] of [...pkgToMsgs.entries()].sort()) {
        indexLines.push(`  export namespace ${ns} {`);
        for (const m of msgs.sort((a,b) => a.inputName.localeCompare(b.inputName))) {
            indexLines.push(`    export type ${m.inputName} = Inputs.${m.inputName};`);
        }
        indexLines.push(`  }`);
    }
    indexLines.push(`}`);
    fs.writeFileSync(path.join(FACADE_ROOT, "index.ts"), indexLines.join("\n"));

    const serviceLines = [
        `// @generated by scripts/generate_facade.ts`, `// DO NOT EDIT MANUALLY`,
        `import { Transport, createPromiseClient } from "@connectrpc/connect";`,
        `import { T } from "./index.js";`
    ];

    for (const s of SERVICES) {
        const connPath = `../gen/${s.relPath}`;
        const pbPath = connPath.replace("_connect.js", "_pb.js");
        serviceLines.push(`import * as ServiceMod from "${connPath}";`);
        serviceLines.push(`import * as PB from "${pbPath}";`);
        serviceLines.push(``, `export class ${s.name}Facade {`, `  private client;`, `  constructor(transport: Transport) {`, `    this.client = createPromiseClient((ServiceMod as any).${s.name}Service, transport);`, `  }`, ``);
        for (const [name, m] of Object.entries(s.service.methods) as any) {
            if (m.kind !== MethodKind.Unary) continue;
            const msg = messages.get(m.I.typeName);
            if (!msg) continue;
            const ns = relPathToNamespace(msg.targetFile);
            serviceLines.push(`  async ${name}(input: T.${ns}.${msg.inputName}) {`, `    const req = new (PB as any).${m.I.name}(input as any);`, `    return await this.client.${name}(req);`, `  }`, ``);
        }
        serviceLines.push(`}`);
    }
    fs.writeFileSync(path.join(FACADE_ROOT, "services.ts"), serviceLines.join("\n"));
}

function main() {
    buildTypeMaps(); scanGenExports();
    for (const s of SERVICES) {
        for (const [, m] of Object.entries(s.service.methods) as any) {
            if (m.kind === MethodKind.Unary) { discover(m.I); discover(m.O); }
        }
    }
    if (fs.existsSync(FACADE_ROOT)) fs.rmSync(FACADE_ROOT, { recursive: true });
    fs.mkdirSync(FACADE_ROOT, { recursive: true });
    generate();
}
main();
