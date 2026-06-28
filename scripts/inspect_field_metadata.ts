#!/usr/bin/env npx tsx
/**
 * inspect_field_metadata.ts
 * 
 * FileDescriptorProto からフィールドの label, options, proto3_optional などの
 * メタデータを調査し、「必須/任意」を判定できる情報が残っているか確認する。
 */

import * as path from "path";
import { extractDescriptors } from "./lib/extractor";

const LABEL_MAP: Record<number, string> = {
    1: "LABEL_OPTIONAL",
    2: "LABEL_REQUIRED",
    3: "LABEL_REPEATED",
};

function main() {
    const filter = process.argv[2] || "SendUserCascadeMessageRequest";
    
    const bundlePath = path.resolve(__dirname, "../resource/extension_formatted.js");
    console.log(`Scanning: ${bundlePath}`);
    console.log(`Filter: ${filter}\n`);

    const extracted = extractDescriptors(bundlePath);

    for (const d of extracted) {
        searchMessages(d.proto.messageType as any[], d.proto.package || "", filter);
    }
}

function searchMessages(msgs: any[], pkg: string, filter: string) {
    for (const m of msgs) {
        const fullName = pkg ? `${pkg}.${m.name}` : m.name;
        
        if (m.name?.includes(filter) || fullName.includes(filter)) {
            console.log(`=== ${fullName} ===`);
            console.log(`  Fields: ${m.field?.length || 0}`);
            console.log(`  Options keys: ${m.options ? Object.keys(m.options).join(", ") : "(none)"}`);
            console.log(`  Options raw: ${JSON.stringify(m.options, null, 2)}`);
            console.log();
            
            if (m.field) {
                for (const f of m.field) {
                    const label = LABEL_MAP[f.label] || `UNKNOWN(${f.label})`;
                    const typeName = f.typeName || `scalar(${f.type})`;
                    const proto3Opt = f.proto3Optional ? " [proto3_optional]" : "";
                    const optionsStr = f.options ? ` options=${JSON.stringify(f.options)}` : "";
                    
                    console.log(`  [${label}] ${f.name} (${typeName}) #${f.number}${proto3Opt}${optionsStr}`);
                }
            }
            console.log();
        }
        
        // ネストされたメッセージも探索
        if (m.nestedType) {
            searchMessages(m.nestedType, fullName, filter);
        }
    }
}

main();
