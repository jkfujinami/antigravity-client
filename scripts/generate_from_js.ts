
import * as fs from "fs-extra";
import * as path from "path";
import * as ts from "typescript";

// Data structures
interface FieldDef {
  no: number;
  name: string;
  kind: string; // scalar, message, enum, map
  T_var?: string; // variable name of type reference (e.g. 'ti')
  T_scalar?: string; // scalar type name (e.g. 'int32')
  repeated?: boolean;
  oneof?: string;
  // For maps
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
    name: string; // PascalCase name e.g. StartCascade
    I_var: string; // Input type variable
    O_var: string; // Output type variable
    serverStreaming?: boolean;
}

interface ServiceDef {
    varName: string;
    fullName: string; // exa.language_server_pb.LanguageServerService
    methods: MethodDef[];
}

// Protobuf scalar types enum values
const SCALAR_ID_MAP: Record<number, string> = {
    1: "double", 2: "float", 3: "int64", 4: "uint64", 5: "int32",
    6: "fixed64", 7: "fixed32", 8: "bool", 9: "string", 11: "message",
    12: "bytes", 13: "uint32", 14: "enum", 15: "sfixed32", 16: "sfixed64",
    17: "sint32", 18: "sint64"
};

async function generate() {
  const jsFiles = [
    path.resolve(__dirname, "../media_chat_formatted.js"),
    path.resolve(__dirname, "../extension_formatted.js"),
  ];
      const outDir = path.resolve(__dirname, "../src/proto_generated");

  const messageMap = new Map<string, MessageDef>(); // varName -> MessageDef
  const enumMap = new Map<string, EnumDef>(); // varName -> EnumDef
  const serviceMap = new Map<string, ServiceDef>(); // varName -> ServiceDef

  // Helpers for deduplication
  const uniqueMessages = new Map<string, MessageDef>(); // fullName -> MessageDef
  const uniqueEnums = new Map<string, EnumDef>(); // fullName -> EnumDef
  const uniqueServices = new Map<string, ServiceDef>(); // fullName -> ServiceDef

  const addMessage = (varName: string, fullName: string) => {
      if (!uniqueMessages.has(fullName)) {
          uniqueMessages.set(fullName, { varName, fullName, fields: [] });
      }
      messageMap.set(varName, uniqueMessages.get(fullName)!);
  };

  const addEnum = (varName: string, fullName: string, values: {name: string, no: number}[]) => {
      if (!uniqueEnums.has(fullName)) {
          uniqueEnums.set(fullName, { varName, fullName, values });
      }
      enumMap.set(varName, uniqueEnums.get(fullName)!);
  };

  const addService = (varName: string, fullName: string, methods: MethodDef[]) => {
      if (!uniqueServices.has(fullName)) {
          uniqueServices.set(fullName, { varName, fullName, methods });
      }
      serviceMap.set(varName, uniqueServices.get(fullName)!);
  };

  // 1. Pass 1: Scan all files for Definitions
  for (const jsFile of jsFiles) {
    if (fs.existsSync(jsFile)) {
        console.log(`Scanning ${jsFile}...`);
        const content = await fs.readFile(jsFile, "utf-8");
        scanDefinitions(content, addMessage, addEnum, addService);
    }
  }

  console.log(`Found ${uniqueMessages.size} unique messages, ${uniqueEnums.size} unique enums, ${uniqueServices.size} unique services.`);

  // 2. Pass 2: Parse fields
  for (const jsFile of jsFiles) {
      if (fs.existsSync(jsFile)) {
          const content = await fs.readFile(jsFile, "utf-8");
          parseMessageFields(content, messageMap);
      }
  }

  // 3. Generate Proto
  await fs.emptyDir(outDir);

  // Group by package using UNIQUE definitions
  const packages: Record<string, (MessageDef | EnumDef | ServiceDef)[]> = {};

  const addToPackage = (def: MessageDef | EnumDef | ServiceDef) => {
      const pkgName = getPackageName(def.fullName);
      if (!packages[pkgName]) packages[pkgName] = [];
      packages[pkgName].push(def);
  };

  uniqueMessages.forEach(addToPackage);
  uniqueEnums.forEach(addToPackage);
  uniqueServices.forEach(addToPackage);

  for (const pkgName of Object.keys(packages)) {
      if (pkgName.startsWith("google.protobuf")) continue;

      const items = packages[pkgName];
      const protoContent = generateProtoContent(pkgName, items, messageMap, enumMap);

      const filePath = path.join(outDir, ...pkgName.split(".")) + ".proto";
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, protoContent);
      console.log(`Generated ${filePath}`);
  }
}

function getPackageName(fullName: string): string {
    const parts = fullName.split(".");
    const firstUpperIndex = parts.findIndex(p => p.length > 0 && p[0] === p[0].toUpperCase() && p[0] !== p[0].toLowerCase());
    if (firstUpperIndex > 0) return parts.slice(0, firstUpperIndex).join(".");

    if (parts.length > 1) return parts.slice(0, -1).join(".");
    return "common";
}

function scanDefinitions(
    content: string,
    addMessage: (varName: string, fullName: string) => void,
    addEnum: (varName: string, fullName: string, values: {name: string, no: number}[]) => void,
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
                     // Check if it's a ClassDeclaration with a name (e.g. class t7e ...)
                     if (ts.isClassDeclaration(classExpr) && classExpr.name) {
                         addMessage(classExpr.name.text, fullName);
                     } else {
                         // It's a ClassExpression (e.g. Var = class ...), check parent assignment
                         const parent = classExpr.parent;
                         if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                              const left = parent.left;
                              if (ts.isIdentifier(left)) {
                                 addMessage(left.text, fullName);
                              }
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

        // Pattern 3: Enum definition
        if (ts.isCallExpression(node)) {
             const expr = node.expression;
             if (ts.isPropertyAccessExpression(expr) && expr.name.text === "setEnumType") {
                 const args = node.arguments;
                 if (args.length >= 3) {
                     const varArg = args[0];
                     const nameArg = args[1];
                     const valuesArg = args[2];

                     if (ts.isIdentifier(varArg) && ts.isStringLiteral(nameArg) && ts.isArrayLiteralExpression(valuesArg)) {
                         const varName = varArg.text;
                         const fullName = nameArg.text;
                         const values: {name: string, no: number}[] = [];

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
                         addEnum(varName, fullName, values);
                     }
                 }
             }
        }

        // Pattern 4: Service Definitions
        // const Var = { typeName: "...", methods: { ... } }
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
                          let mName = "";
                          let I_var = "";
                          let O_var = "";
                          let serverStreaming = false;

                          mp.initializer.properties.forEach(prop => {
                              if (ts.isPropertyAssignment(prop)) {
                                  const val = prop.initializer;
                                  if (ts.isIdentifier(prop.name)) {
                                      if (prop.name.text === "name" && ts.isStringLiteral(val)) mName = val.text;
                                      if ((prop.name.text === "I" || prop.name.text === "i") && ts.isIdentifier(val)) I_var = val.text;
                                      if ((prop.name.text === "O" || prop.name.text === "o") && ts.isIdentifier(val)) O_var = val.text;
                                      if (prop.name.text === "kind") {
                                          if (ts.isPropertyAccessExpression(val) && val.name.text.includes("ServerStreaming")) {
                                              serverStreaming = true;
                                          }
                                      }
                                  }
                              }
                          });

                          if (mName && I_var && O_var) {
                              methods.push({ name: mName, I_var, O_var, serverStreaming });
                          }
                     }
                 });
                 addService(varName, typeName, methods);
             }
        }

        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
}


function parseMessageFields(content: string, messageMap: Map<string, MessageDef>) {
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
            const messageDef = messageMap.get(varName);
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

function generateProtoContent(pkgName: string, items: (MessageDef | EnumDef | ServiceDef)[], msgMap: Map<string, MessageDef>, enumMap: Map<string, EnumDef>): string {
    let lines = [`syntax = "proto3";`, `package ${pkgName};`, ``];

    // Imports
    const imports = new Set<string>();
    const collectImports = (def: MessageDef | EnumDef | ServiceDef) => {
        if ('values' in def) return;
        if ('methods' in def) {
            // Service import collection
            def.methods.forEach(m => {
                 [m.I_var, m.O_var].forEach(tVar => {
                     const typeDef = msgMap.get(tVar) || enumMap.get(tVar);
                     if (typeDef) {
                        const refPkg = getPackageName(typeDef.fullName);
                        if (refPkg === pkgName) return;
                        if (refPkg === "google.protobuf") {
                             const typeName = typeDef.fullName.split('.').pop();
                             if (typeName) imports.add(`google/protobuf/${typeName.toLowerCase()}`);
                        } else {
                             imports.add(refPkg.split('.').join('/'));
                        }
                     }
                 });
            });
            return;
        }

        // Message import collection
        for (const f of def.fields) {
            const checkType = (tVar: string | undefined) => {
                if (tVar) {
                    const typeDef = msgMap.get(tVar) || enumMap.get(tVar);
                    if (typeDef) {
                        const refPkg = getPackageName(typeDef.fullName);
                        if (refPkg === pkgName) return;

                        if (refPkg === "google.protobuf") {
                             // Handle WKTs: google.protobuf.Empty -> google/protobuf/empty.proto
                             const typeName = typeDef.fullName.split('.').pop();
                             if (typeName) {
                                 imports.add(`google/protobuf/${typeName.toLowerCase()}`);
                             }
                        } else {
                             imports.add(refPkg.split('.').join('/'));
                        }
                    }
                }
            };
            checkType(f.T_var);
            if (f.kind === "map") checkType(f.V_T_var);
        }
    };
    items.forEach(collectImports);

    Array.from(imports).sort().forEach(imp => lines.push(`import "${imp}.proto";`));
    lines.push("");
    lines.push("message BackupMessage { bytes data = 1; }"); // Backup message for unresolved types
    lines.push("");

    // Generate Items
    for (const item of items) {
        if ('values' in item) { // Enum
            const simpleName = resolveLocalName(item.fullName, pkgName);
            lines.push(`enum ${simpleName} {`);
            item.values.forEach(v => {
                const prefix = simpleName.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "") + "_";
                let name = v.name;
                if (!name.startsWith(prefix)) {
                    name = prefix + name;
                }
                lines.push(`  ${name} = ${v.no};`);
            });
            lines.push(`}`);
        } else if ('methods' in item) { // Service
            const simpleName = resolveLocalName(item.fullName, pkgName);
            lines.push(`service ${simpleName} {`);
            item.methods.forEach(m => {
                 let inputType = "BackupMessage"; // Fallback to a valid message type
                 let outputType = "BackupMessage";

                 if (msgMap.has(m.I_var)) {
                     const def = msgMap.get(m.I_var)!;
                     inputType = def.fullName.startsWith(pkgName + ".") ? resolveLocalName(def.fullName, pkgName) : def.fullName;
                 } else {
                     console.warn(`[Service ${item.varName}] Method ${m.name}: Input var '${m.I_var}' not found in messageMap.`);
                 }

                 if (msgMap.has(m.O_var)) {
                     const def = msgMap.get(m.O_var)!;
                     outputType = def.fullName.startsWith(pkgName + ".") ? resolveLocalName(def.fullName, pkgName) : def.fullName;
                 } else {
                     console.warn(`[Service ${item.varName}] Method ${m.name}: Output var '${m.O_var}' not found in messageMap.`);
                 }

                 const streamPrefix = m.serverStreaming ? "stream " : "";
                 lines.push(`  rpc ${m.name}(${inputType}) returns (${streamPrefix}${outputType});`);
            });
            lines.push(`}`);
        } else { // Message
            const simpleName = resolveLocalName(item.fullName, pkgName);
            lines.push(`message ${simpleName} {`);

            const oneofs = new Set(item.fields.filter(f => f.oneof).map(f => f.oneof!));
            const distinctOneofs = Array.from(oneofs);

            // Regular fields
            item.fields.filter(f => !f.oneof).forEach(f => lines.push(`  ${genField(f, pkgName, msgMap, enumMap)};`));

            // Oneof fields
            distinctOneofs.forEach(oName => {
                lines.push(`  oneof ${oName} {`);
                item.fields.filter(f => f.oneof === oName).forEach(f => lines.push(`    ${genField(f, pkgName, msgMap, enumMap)};`));
                lines.push(`  }`);
            });

            lines.push(`}`);
        }
        lines.push("");
    }

    return lines.join("\n");
}

function resolveLocalName(fullName: string, currentPkg: string): string {
    if (fullName.startsWith(currentPkg + ".")) {
        return fullName.slice(currentPkg.length + 1).split(".").join("_");
    }
    return fullName.split(".").pop()!;
}

function genField(f: FieldDef, currentPkg: string, msgMap: Map<string, MessageDef>, enumMap: Map<string, EnumDef>): string {
    let typeStr = "bytes"; // default fallback

    if (f.kind === "scalar") {
        typeStr = f.T_scalar || "string";
    } else if (f.kind === "message" || f.kind === "enum") {
        if (f.T_var) {
            const def = msgMap.get(f.T_var) || enumMap.get(f.T_var);
            if (def) {
                if (def.fullName.startsWith(currentPkg + ".")) {
                    typeStr = resolveLocalName(def.fullName, currentPkg);
                } else {
                    typeStr = def.fullName;
                }
            }
        }
    } else if (f.kind === "map") {
        const key = f.K_scalar ? SCALAR_ID_MAP[parseInt(f.K_scalar)] || "string" : "string";
        let val = "bytes";
        if (f.V_kind === "scalar") val = f.V_scalar || "string";
        else if (f.V_kind === "message" || f.V_kind === "enum") {
             if (f.V_T_var) {
                 const def = msgMap.get(f.V_T_var) || enumMap.get(f.V_T_var);
                 if (def) {
                      if (def.fullName.startsWith(currentPkg + ".")) val = resolveLocalName(def.fullName, currentPkg);
                      else val = def.fullName;
                 }
             }
        }
        return `map<${key}, ${val}> ${f.name} = ${f.no}`;
    }

    const label = (f.repeated && !f.oneof) ? "repeated " : "";
    return `${label}${typeStr} ${f.name} = ${f.no}`;
}

generate().catch(console.error);
