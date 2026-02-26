import * as fs from "fs-extra";
import * as path from "path";
import { FileDescriptorProto } from "@bufbuild/protobuf";

const SCALAR_TYPE_MAP: Record<number, string> = {
    1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32",
    6: "fixed64", 7: "fixed32", 8: "bool", 9: "string",
    12: "bytes", 13: "uint32", 15: "sfixed32", 16: "sfixed64",
    17: "sint32", 18: "sint64"
};

function resolveType(typeId: number, typeName: string | undefined): string {
    if (typeId === 11 || typeId === 14) {
        if (!typeName) return "bytes";
        return typeName.startsWith(".") ? typeName.substring(1) : typeName;
    }
    return SCALAR_TYPE_MAP[typeId] || "string";
}

async function generate() {
    const jsFiles = [
        path.resolve(__dirname, "../resource/chat_formatted.js"),
        path.resolve(__dirname, "../resource/extension_formatted.js"),
    ];
    const outDir = path.resolve(__dirname, "../src/proto_generated");

    const descriptors = new Map<string, FileDescriptorProto>();

    // 1. Extract Base64 encoded FileDescriptorProtos from the JS bundles
    const regex = /(?:"|')([A-Za-z0-9+/=]{100,})(?:"|')/g;

    for (const jsFile of jsFiles) {
        if (!fs.existsSync(jsFile)) continue;
        console.log(`Scanning ${jsFile}...`);
        const content = await fs.readFile(jsFile, "utf-8");
        for (const match of content.matchAll(regex)) {
            try {
                const bytes = Buffer.from(match[1], "base64");
                const desc = FileDescriptorProto.fromBinary(bytes);
                if (desc.package) {
                    descriptors.set(desc.name!, desc);
                }
            } catch (e) {
                // Ignore parsing failures
            }
        }
    }

    console.log(`Found ${descriptors.size} valid protobuf file descriptors.`);

    // 2. Build a complete set of ALL known type names from ALL extracted descriptors
    const knownTypes = new Set<string>();
    const pkgToFilename = new Map<string, string>();

    for (const [fname, d] of descriptors.entries()) {
        if (!d.package) continue;
        pkgToFilename.set(d.package, fname);

        const collectTypes = (msgs: any[], prefix: string) => {
            for (const m of msgs) {
                const fullName = prefix + "." + m.name;
                knownTypes.add(fullName);
                if (m.nestedType) collectTypes(m.nestedType, fullName);
                if (m.enumType) {
                    for (const e of m.enumType) {
                        knownTypes.add(fullName + "." + e.name);
                    }
                }
            }
        };

        collectTypes(d.messageType, d.package);
        for (const e of d.enumType) {
            knownTypes.add(d.package + "." + e.name);
        }
    }

    console.log(`Known types: ${knownTypes.size}`);

    // 3. Determine which packages to generate (skip standard library)
    const skipPkgs = new Set<string>();
    for (const [, d] of descriptors.entries()) {
        const pkg = d.package || "";
        if (pkg.startsWith("google.protobuf") || pkg === "pb" ||
            pkg === "google.rpc" || pkg === "google.type") {
            skipPkgs.add(pkg);
        }
    }

    await fs.emptyDir(outDir);

    // 4. Generate .proto files
    for (const [filename, desc] of descriptors.entries()) {
        const pkg = desc.package || "common";
        if (skipPkgs.has(pkg)) continue;

        // Safe type resolver: if a type is not in knownTypes, fallback to bytes
        const safeResolveType = (typeId: number, typeName: string | undefined): string => {
            if (typeId === 11 || typeId === 14) {
                if (!typeName) return "bytes";
                const fqn = typeName.startsWith(".") ? typeName.substring(1) : typeName;

                // Same package = always OK (including nested)
                if (fqn.startsWith(pkg + ".")) return fqn;

                // Check if this type exists in our extracted set
                if (knownTypes.has(fqn) && !skipPkgs.has(fqn.split(".").slice(0, -1).join("."))) {
                    return fqn;
                }

                // Not found in JS bundles → bytes
                return "bytes";
            }
            return SCALAR_TYPE_MAP[typeId] || "string";
        };

        let lines: string[] = [];
        lines.push(`syntax = "proto3";`);
        lines.push(`package ${pkg};`);
        lines.push(``);

        // Compute imports: scan all fields, collect packages of resolved types
        const importFiles = new Set<string>();

        // Build type→filename mapping for same-package cross-file resolution
        const typeToFile = new Map<string, string>();
        for (const [fname, d] of descriptors.entries()) {
            if (!d.package) continue;
            const addTypesToFile = (msgs: any[], prefix: string) => {
                for (const m of msgs) {
                    typeToFile.set(prefix + "." + m.name, fname);
                    if (m.nestedType) addTypesToFile(m.nestedType, prefix + "." + m.name);
                    if (m.enumType) {
                        for (const e of m.enumType) typeToFile.set(prefix + "." + m.name + "." + e.name, fname);
                    }
                }
            };
            addTypesToFile(d.messageType, d.package);
            for (const e of d.enumType) typeToFile.set(d.package + "." + e.name, fname);
        }

        const scanImports = (msgs: any[]) => {
            for (const m of msgs) {
                if (m.field) {
                    for (const f of m.field) {
                        if ((f.type === 11 || f.type === 14) && f.typeName) {
                            const fqn = f.typeName.startsWith(".") ? f.typeName.substring(1) : f.typeName;
                            if (knownTypes.has(fqn)) {
                                const typeFile = typeToFile.get(fqn);
                                if (typeFile && typeFile !== filename && !skipPkgs.has(fqn.split(".").slice(0, -1).join("."))) {
                                    importFiles.add(typeFile);
                                }
                            }
                        }
                    }
                }
                if (m.nestedType) scanImports(m.nestedType);
            }
        };

        scanImports(desc.messageType);

        // Also scan service method types for imports
        for (const s of desc.service) {
            if (s.method) {
                for (const m of s.method) {
                    for (const typeName of [m.inputType, m.outputType]) {
                        if (!typeName) continue;
                        const fqn = typeName.startsWith(".") ? typeName.substring(1) : typeName;
                        if (knownTypes.has(fqn)) {
                            const typeFile = typeToFile.get(fqn);
                            if (typeFile && typeFile !== filename && !skipPkgs.has(fqn.split(".").slice(0, -1).join("."))) {
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

        // Enums
        for (const e of desc.enumType) {
            lines.push(`enum ${e.name} {`);
            for (const v of e.value) {
                lines.push(`  ${v.name} = ${v.number};`);
            }
            lines.push(`}`);
            lines.push("");
        }

        // Messages (recursive)
        const renderMessage = (m: any, indent: string) => {
            lines.push(`${indent}message ${m.name} {`);

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

            if (m.nestedType) {
                for (const subM of m.nestedType) {
                    renderMessage(subM, indent + "  ");
                }
            }

            const oneofDecls = m.oneofDecl || [];
            const fieldsByOneof = new Map<number, any[]>();
            const regularFields: any[] = [];

            if (m.field) {
                m.field.forEach((f: any) => {
                    if (f.oneofIndex !== undefined && f.oneofIndex !== null && !f.proto3Optional) {
                        if (!fieldsByOneof.has(f.oneofIndex)) fieldsByOneof.set(f.oneofIndex, []);
                        fieldsByOneof.get(f.oneofIndex)!.push(f);
                    } else {
                        regularFields.push(f);
                    }
                });
            }

            const renderField = (f: any, fIndent: string) => {
                let label = f.label === 3 ? "repeated " : "";
                let typeStr = safeResolveType(f.type, f.typeName);
                lines.push(`${fIndent}${label}${typeStr} ${f.name} = ${f.number};`);
            };

            for (const f of regularFields) {
                renderField(f, indent + "  ");
            }

            for (const [idx, fields] of fieldsByOneof.entries()) {
                lines.push(`${indent}  oneof ${oneofDecls[idx].name} {`);
                for (const f of fields) {
                    renderField(f, indent + "    ");
                }
                lines.push(`${indent}  }`);
            }

            lines.push(`${indent}}`);
            lines.push("");
        };

        for (const m of desc.messageType) {
            renderMessage(m, "");
        }

        // Services
        for (const s of desc.service) {
            lines.push(`service ${s.name} {`);
            for (const m of s.method) {
                const inType = safeResolveType(11, m.inputType);
                const outType = safeResolveType(11, m.outputType);
                const inStream = m.clientStreaming ? "stream " : "";
                const outStream = m.serverStreaming ? "stream " : "";
                lines.push(`  rpc ${m.name}(${inStream}${inType}) returns (${outStream}${outType});`);
            }
            lines.push(`}`);
            lines.push("");
        }

        let relPath = filename;
        if (!relPath.endsWith(".proto")) relPath += ".proto";
        const filePath = path.join(outDir, relPath);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, lines.join("\n"));
        console.log(`Generated ${filePath}`);
    }
}

generate().catch(console.error);
