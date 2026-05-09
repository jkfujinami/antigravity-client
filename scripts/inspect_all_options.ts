#!/usr/bin/env npx tsx
/**
 * inspect_all_options.ts
 * 
 * 全ディスクリプタから、options が設定されているフィールドを抽出し、
 * どのようなメタデータが利用可能かを調査する。
 */

import * as path from "path";
import { extractDescriptors } from "./lib/extractor";

const LABEL_MAP: Record<number, string> = {
    1: "OPT",
    2: "REQ",
    3: "REP",
};

function main() {
    const bundlePaths = [
        path.resolve(__dirname, "../resource/extension_formatted.js"),
        path.resolve(__dirname, "../resource/chat_formatted.js"),
    ];

    let totalFields = 0;
    let fieldsWithOptions = 0;
    let deprecatedCount = 0;
    let requiredLabelCount = 0;
    const uniqueOptionKeys = new Set<string>();
    const deprecatedFields: string[] = [];
    const requiredFields: string[] = [];

    for (const bundlePath of bundlePaths) {
        try {
            const extracted = extractDescriptors(bundlePath);
            for (const d of extracted) {
                scanMessages(d.proto.messageType as any[], d.proto.package || "");
            }
        } catch {
            continue;
        }
    }

    function scanMessages(msgs: any[], pkg: string) {
        for (const m of msgs) {
            const fullName = pkg ? `${pkg}.${m.name}` : m.name;
            if (m.field) {
                for (const f of m.field) {
                    totalFields++;
                    
                    // LABEL_REQUIRED チェック
                    if (f.label === 2) {
                        requiredLabelCount++;
                        requiredFields.push(`${fullName}.${f.name}`);
                    }
                    
                    if (f.options && Object.keys(f.options).length > 0) {
                        // options のうち、空配列以外の実質的な値を持つものだけカウント
                        const meaningfulKeys = Object.entries(f.options).filter(([k, v]) => {
                            if (Array.isArray(v) && v.length === 0) return false;
                            if (v === undefined || v === null || v === false || v === 0) return false;
                            return true;
                        });
                        
                        if (meaningfulKeys.length > 0) {
                            fieldsWithOptions++;
                            for (const [k] of meaningfulKeys) {
                                uniqueOptionKeys.add(k);
                            }
                            
                            if ((f.options as any).deprecated) {
                                deprecatedCount++;
                                deprecatedFields.push(`${fullName}.${f.name}`);
                            }
                        }
                    }
                }
            }
            if (m.nestedType) scanMessages(m.nestedType, fullName);
        }
    }

    console.log("=== Field Metadata Survey ===\n");
    console.log(`Total fields scanned: ${totalFields}`);
    console.log(`Fields with LABEL_REQUIRED: ${requiredLabelCount}`);
    console.log(`Fields with meaningful options: ${fieldsWithOptions}`);
    console.log(`  of which deprecated: ${deprecatedCount}`);
    console.log(`\nUnique option keys found: ${[...uniqueOptionKeys].join(", ")}`);
    
    if (requiredFields.length > 0) {
        console.log(`\n--- LABEL_REQUIRED fields ---`);
        for (const f of requiredFields) console.log(`  ${f}`);
    }
    
    console.log(`\n--- Deprecated fields (${deprecatedCount}) ---`);
    for (const f of deprecatedFields.slice(0, 30)) console.log(`  ${f}`);
    if (deprecatedFields.length > 30) console.log(`  ... and ${deprecatedFields.length - 30} more`);
}

main();
