
import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";

// Define the ProtoType interface based on proto_types.json structure
interface ProtoField {
  no: number;
  name: string;
  kind: "scalar" | "message" | "enum" | "map";
  scalarType?: string; // for scalars
  typeRef?: string; // for messages: "pkg.MessageName" or "unresolved:..."
  enumRef?: string; // for enums: "unresolved_enum:varName"
  mapKey?: string; // for map keys (scalar type)
  mapValue?: ProtoField; // for map values
  repeated?: boolean;
  oneof?: string; // name of the oneof group
}

interface ProtoType {
  typeName: string; // "pkg.MessageName"
  className: string;
  fields: ProtoField[];
  oneofs?: string[];
}

interface EnumDefinition {
  fullName: string; // "pkg.EnumName"
  varName: string; // "gze"
  values: { name: string; no: number }[];
}

const SCALAR_TYPE_MAP: Record<string, string> = {
  double: "double",
  float: "float",
  int32: "int32",
  int64: "int64",
  uint32: "uint32",
  uint64: "uint64",
  sint32: "sint32",
  sint64: "sint64",
  fixed32: "fixed32",
  fixed64: "fixed64",
  sfixed32: "sfixed32",
  sfixed64: "sfixed64",
  bool: "bool",
  string: "string",
  bytes: "bytes",
};

// Map unresolved types to known types manually if needed
const UNRESOLVED_TYPE_MAP: Record<string, string> = {
  "unresolved:sje": "int64", // Timestamp typically
};

async function generate() {
  const jsonPath = path.resolve(__dirname, "../proto_types.json");
  const jsFiles = [
    path.resolve(__dirname, "../media_chat_formatted.js"),
    path.resolve(__dirname, "../extension_formatted.js"),
  ];
  const outDir = path.resolve(__dirname, "../src/proto_generated");

  console.log(`Reading ${jsonPath}...`);
  if (!fs.existsSync(jsonPath)) {
    console.error("proto_types.json not found!");
    process.exit(1);
  }

  const data: Record<string, ProtoType> = await fs.readJson(jsonPath);

  // 1. Extract Enum definitions from JS files using AST
  const enums = new Map<string, EnumDefinition>(); // encoded varName -> EnumDefinition
  const enumsByFullName = new Map<string, EnumDefinition>();

  for (const jsFile of jsFiles) {
    if (fs.existsSync(jsFile)) {
      console.log(`Parsing ${jsFile} for Enums...`);
      const content = await fs.readFile(jsFile, "utf-8");
      extractEnumsFromSource(content, enums, enumsByFullName);
    }
  }
  console.log(`Found ${enums.size} enums.`);

  // 2. Resolve types and group by package
  const packages: Record<string, (ProtoType | EnumDefinition)[]> = {};

  // Add Messages
  for (const typeName of Object.keys(data)) {
    const pkgName = getPackageName(typeName);
    if (!packages[pkgName]) packages[pkgName] = [];
    packages[pkgName].push(data[typeName]);
  }

  // Add Enums
  for (const enumDef of enumsByFullName.values()) {
      const pkgName = getPackageName(enumDef.fullName);
      if (!packages[pkgName]) packages[pkgName] = [];
      packages[pkgName].push(enumDef);
  }

  // Clear output dir
  await fs.emptyDir(outDir);

  // 3. Generate .proto files
  for (const pkgName of Object.keys(packages)) {
    if (pkgName.startsWith("google.protobuf")) continue;

    // Sort items: Enums first, then Messages
    const items = packages[pkgName].sort((a, b) => {
        const isEnumA = 'values' in a;
        const isEnumB = 'values' in b;
        if (isEnumA && !isEnumB) return -1;
        if (!isEnumA && isEnumB) return 1;
        return 0;
    });

    const protoContent = generateProtoContent(pkgName, items, enums, Object.keys(packages));

    // Output path: pkg/name.proto
    const filePath = path.join(outDir, ...pkgName.split(".")) + ".proto";
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, protoContent);
    console.log(`Generated ${filePath}`);
  }
}

function getPackageName(fullName: string): string {
    const parts = fullName.split(".");
    // Find first part that starts with uppercase
    const firstUpperIndex = parts.findIndex(p => p.length > 0 && p[0] === p[0].toUpperCase() && p[0] !== p[0].toLowerCase());

    if (firstUpperIndex > 0) {
        return parts.slice(0, firstUpperIndex).join(".");
    }
    // Fallback: use all but last part if no uppercase found (e.g. strict lower packages)
    if (parts.length > 1) {
        return parts.slice(0, -1).join(".");
    }
    return "common";
}

// Helpers for name resolution
function resolveLocalName(fullName: string, currentPkg: string): string {
    if (fullName.startsWith(currentPkg + ".")) {
        // e.g. pkg.Parent.Child -> Parent_Child inside package 'pkg'
        return fullName.slice(currentPkg.length + 1).split(".").join("_");
    }
    return fullName.split(".").pop()!;
}

function resolveTypeRef(fullName: string, currentPkg: string): string {
    if (fullName.startsWith(currentPkg + ".")) {
        // Internal reference: use flat definition name
        return resolveLocalName(fullName, currentPkg);
    }
    // External reference: use fully qualified name
    return fullName;
}


function extractEnumsFromSource(sourceText: string, enums: Map<string, EnumDefinition>, enumsByFullName: Map<string, EnumDefinition>) {
    const sourceFile = ts.createSourceFile("temp.js", sourceText, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            const expr = node.expression;
            if (ts.isPropertyAccessExpression(expr) && expr.name.text === "setEnumType") {
                const args = node.arguments;
                if (args.length >= 3) {
                    const varNameNode = args[0];
                    const fullNameNode = args[1];
                    const valuesNode = args[2];

                    let varName = "";
                    if (ts.isIdentifier(varNameNode)) {
                        varName = varNameNode.text;
                    }

                    let fullName = "";
                    if (ts.isStringLiteral(fullNameNode)) {
                        fullName = fullNameNode.text;
                    }

                    if (varName && fullName && ts.isArrayLiteralExpression(valuesNode)) {
                        const values: { name: string; no: number }[] = [];

                        for (const element of valuesNode.elements) {
                            if (ts.isObjectLiteralExpression(element)) {
                                let name = "";
                                let no = -1;

                                for (const prop of element.properties) {
                                    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                                        if (prop.name.text === "name" && ts.isStringLiteral(prop.initializer)) {
                                            name = prop.initializer.text;
                                        } else if (prop.name.text === "no" && ts.isNumericLiteral(prop.initializer)) {
                                            no = parseInt(prop.initializer.text, 10);
                                        }
                                    }
                                }

                                if (name && no !== -1) {
                                    values.push({ name, no });
                                }
                            }
                        }

                        const def: EnumDefinition = { fullName, varName, values };
                        enums.set(varName, def);
                        enumsByFullName.set(fullName, def);
                    }
                }
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
}

function generateProtoContent(pkgName: string, items: (ProtoType | EnumDefinition)[], enums: Map<string, EnumDefinition>, allPackages: string[]): string {
  let lines: string[] = [];
  lines.push('syntax = "proto3";');
  lines.push(`package ${pkgName};`);
  lines.push("");

  // Imports
  const imports = new Set<string>();

  for (const item of items) {
      if ('fields' in item) { // Message
          for (const field of item.fields) {
              collectImports(field, pkgName, allPackages, enums, imports);
          }
      }
  }

  for (const imp of Array.from(imports).sort()) {
      const importPath = imp.split(".").join("/") + ".proto";
      lines.push(`import "${importPath}";`);
  }
  lines.push("");

  for (const item of items) {
      if ('values' in item) {
          // Enum Generation
          const defName = resolveLocalName(item.fullName, pkgName);
          lines.push(`enum ${defName} {`);
          for (const val of item.values) {
              lines.push(`  ${val.name} = ${val.no};`);
          }
          lines.push(`}`);
          lines.push("");
      } else {
          // Message Generation
          const defName = resolveLocalName(item.typeName, pkgName);
          lines.push(`message ${defName} {`);

          const oneofGroups: Record<string, ProtoField[]> = {};
          const regularFields: ProtoField[] = [];

          for (const field of item.fields) {
              if (field.oneof) {
                  if (!oneofGroups[field.oneof]) oneofGroups[field.oneof] = [];
                  oneofGroups[field.oneof].push(field);
              } else {
                  regularFields.push(field);
              }
          }

          for (const field of regularFields) {
              lines.push(`  ${generateField(field, pkgName, enums)};`);
          }

          for (const oneofName of Object.keys(oneofGroups)) {
              lines.push(`  oneof ${oneofName} {`);
              for (const field of oneofGroups[oneofName]) {
                  lines.push(`    ${generateField(field, pkgName, enums)};`);
              }
              lines.push(`  }`);
          }
          lines.push(`}`);
          lines.push("");
      }
  }

  return lines.join("\n");
}

function collectImports(field: ProtoField, currentPkg: string, allPackages: string[], enums: Map<string, EnumDefinition>, imports: Set<string>) {
    // Message
    if (field.kind === "message" && field.typeRef) {
        if (UNRESOLVED_TYPE_MAP[field.typeRef]) return;
        if (field.typeRef.startsWith("unresolved:")) return;

        const refPkg = getPackageName(field.typeRef);
        if (refPkg !== currentPkg && allPackages.includes(refPkg)) {
            imports.add(refPkg);
        }
    }
    // Enum
    if (field.kind === "enum" && field.enumRef) {
        const varName = field.enumRef.split(":")[1];
        const enumDef = enums.get(varName);
        if (enumDef) {
            const refPkg = getPackageName(enumDef.fullName);
            if (refPkg !== currentPkg && allPackages.includes(refPkg)) {
                imports.add(refPkg);
            }
        }
    }
    // Map Value
    if (field.kind === "map" && field.mapValue) {
        collectImports(field.mapValue, currentPkg, allPackages, enums, imports);
    }
}

function generateField(field: ProtoField, currentPkg: string, enums: Map<string, EnumDefinition>): string {
  let typeStr = "bytes"; // Default fallback

  if (field.kind === "scalar") {
      typeStr = SCALAR_TYPE_MAP[field.scalarType || "string"] || "string";
  } else if (field.kind === "message") {
      if (field.typeRef) {
           if (UNRESOLVED_TYPE_MAP[field.typeRef]) {
               typeStr = UNRESOLVED_TYPE_MAP[field.typeRef];
           } else if (field.typeRef.startsWith("unresolved:")) {
               typeStr = "bytes";
           } else {
               typeStr = resolveTypeRef(field.typeRef, currentPkg);
           }
      } else {
          typeStr = "bytes"; // unknown message
      }
  } else if (field.kind === "enum") {
      if (field.enumRef) {
          const varName = field.enumRef.split(":")[1];
          const enumDef = enums.get(varName);
          if (enumDef) {
              typeStr = resolveTypeRef(enumDef.fullName, currentPkg);
          } else {
              typeStr = "int32"; // Fallback
          }
      } else {
          typeStr = "int32";
      }
  } else if (field.kind === "map") {
      const keyType = SCALAR_TYPE_MAP[field.mapKey || "string"] || "string";
      let valueType = "bytes"; // Default fallback for map value

      if (field.mapValue) {
            if (field.mapValue.kind === "scalar") {
                valueType = SCALAR_TYPE_MAP[field.mapValue.scalarType || "string"] || "string";
            } else if (field.mapValue.kind === "message") {
                 let rawType = field.mapValue.typeRef;
                 if (rawType) {
                     if (UNRESOLVED_TYPE_MAP[rawType]) valueType = UNRESOLVED_TYPE_MAP[rawType];
                     else if (rawType.startsWith("unresolved:")) valueType = "bytes";
                     else valueType = resolveTypeRef(rawType, currentPkg);
                 }
            } else if (field.mapValue.kind === "enum") {
                if (field.mapValue.enumRef) {
                    const varName = field.mapValue.enumRef.split(":")[1];
                    const enumDef = enums.get(varName);
                    valueType = enumDef ? resolveTypeRef(enumDef.fullName, currentPkg) : "int32";
                } else {
                    valueType = "int32";
                }
            }
      }
      return `map<${keyType}, ${valueType}> ${field.name} = ${field.no}`;
  }

  const repeatedStr = field.repeated ? "repeated " : "";
  return `${repeatedStr}${typeStr} ${field.name} = ${field.no}`;
}

generate().catch(console.error);
