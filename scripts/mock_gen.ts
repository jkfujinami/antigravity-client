import { LanguageServerService } from "../src/gen/exa/language_server_pb/language_server_connect.js";
import util from "util";

function getScalarDefault(scalarType: number): any {
    switch (scalarType) {
        case 9: return ""; // STRING
        case 8: return false; // BOOL
        case 1: case 2: return 0.0; // DOUBLE, FLOAT
        case 3: case 4: case 5: case 13: case 14: return 0; // INT64, UINT64, INT32, UINT32, ENUM
        default: return 0;
    }
}

function generateMock(MsgClass: any, visited = new Set<string>()): any {
    if (!MsgClass || !MsgClass.fields) return {};

    const typeName = MsgClass.typeName;
    if (typeName) {
        if (visited.has(typeName)) {
            return "[Recursive Reference]";
        }
        visited.add(typeName);
    }

    const mock: any = {};
    const processedOneofs = new Set<string>();

    for (const field of MsgClass.fields.list()) {
        let value: any;

        // Generate value based on kind
        if (field.kind === "message") {
            value = generateMock(field.T, new Set(visited));
        } else if (field.kind === "enum") {
            value = 0; // default enum value
        } else if (field.kind === "scalar") {
            value = getScalarDefault(field.T);
        } else if (field.kind === "map") {
            value = {};
        }

        // Handle repeated fields
        if (field.repeated) {
            value = [value];
        }

        // Handle oneof fields
        if (field.oneof) {
            const oneofName = field.oneof.name;
            const key = `__ONEOF_CHOICES_FOR_${oneofName}__`;
            if (!mock[key]) {
                mock[key] = [];
            }
            mock[key].push({
                case: field.localName,
                value: value
            });
        } else {
            mock[field.localName] = value;
        }
    }

    return mock;
}

function resolvePath(obj: any, path: string): any {
    if (!path) return obj;
    const parts = path.split(".");
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        // Handle oneof transparency: if we're looking for a property but current object has a 'case' and 'value', it might be a oneof wrapper.
        if (current.case && current.value !== undefined && typeof current.value === "object" && !(part in current)) {
           // We do NOT transparently unwrap here because we want to see the exact structure (with case/value) in the dump.
           // User needs to query it correctly, e.g., customAgentSpec.workspace.value.absolutePaths
        }
        current = current[part];
    }
    return current;
}

function main() {
    const methodName = process.argv[2];
    const targetArg = process.argv[3]; // 'req' or 'res' (optional, defaults to 'req')
    let jsonPath = process.argv[4];

    if (!methodName) {
        console.error("Usage: npx tsx scripts/mock_gen.ts <MethodName> [req|res] [optional.json.path]");
        process.exit(1);
    }

    let targetType = "req";
    if (targetArg === "req" || targetArg === "res") {
        targetType = targetArg;
    } else if (targetArg) {
        // If it's not 'req' or 'res', assume it's the json path for backward compatibility
        jsonPath = targetArg;
    }

    const methods = LanguageServerService.methods as Record<string, any>;
    let method = methods[methodName];
    if (!method) {
        const found = Object.keys(methods).find(k => k.toLowerCase() === methodName.toLowerCase());
        if (found) {
            method = methods[found];
        } else {
            console.error(`❌ Method '${methodName}' not found in LanguageServerService.`);
            process.exit(1);
        }
    }

    const TargetClass = targetType === "req" ? method.I : method.O;
    if (!TargetClass) {
        console.error(`❌ ${targetType.toUpperCase()} class not found for method '${methodName}'.`);
        process.exit(1);
    }

    const mockData = generateMock(TargetClass);
    const extractedData = resolvePath(mockData, jsonPath);

    if (extractedData === undefined) {
        console.error(`❌ Path '${jsonPath}' not found in the generated mock.`);
        process.exit(1);
    }

    console.log(`\n=== Type-Safe Mock for '${methodName}' (${targetType.toUpperCase()})${jsonPath ? ` at path '${jsonPath}'` : ""} ===\n`);

    
    // Use util.inspect to output a valid JS/TS object literal structure (better than JSON.stringify for oneofs and types)
    console.log(util.inspect(extractedData, { depth: null, colors: true, compact: false, breakLength: 80 }));
}

main();
