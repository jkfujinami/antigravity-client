/**
 * Phase 1-2: Base64 抽出 + FileDescriptorProto デコード
 *
 * JS バンドルから Rl("Base64") パターンを検索し、
 * @bufbuild/protobuf の FileDescriptorProto.fromBinary() でデコードする。
 */

import * as fs from "fs";
import { FileDescriptorProto } from "@bufbuild/protobuf";

export interface ExtractedDescriptor {
    /** デコード済みの FileDescriptorProto */
    proto: InstanceType<typeof FileDescriptorProto>;
    /** 元の Base64 文字列（再エンコード検証用） */
    rawBase64: string;
    /** バンドル内でのバイトオフセット（デバッグ用） */
    offset: number;
}

export function extractDescriptors(bundlePath: string): ExtractedDescriptor[] {
    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Bundle not found: ${bundlePath}`);
    }

    const content = fs.readFileSync(bundlePath, "utf8");
    const results: ExtractedDescriptor[] = [];
    const seenNames = new Set<string>();

    const tryExtract = (regex: RegExp) => {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
            const b64 = match[1];
            const offset = match.index;

            try {
                const binary = Buffer.from(b64, "base64");
                const proto = FileDescriptorProto.fromBinary(binary);

                // name フィールドが存在しないものはスキップ
                if (!proto.name) continue;

                // 既に同じ名前のディスクリプタを抽出済みの場合はスキップ
                if (seenNames.has(proto.name)) continue;
                seenNames.add(proto.name);

                results.push({ proto, rawBase64: b64, offset });
            } catch {
                // FileDescriptorProto としてパースできないものはスキップ
            }
        }
    };

    // Legacy pattern: Rl("Base64", [...deps])
    tryExtract(/Rl\s*\(\s*"([A-Za-z0-9+/=]{50,})"/g);

    // v2.0 pattern 1: Strict matching for (0, a.W)("Base64") or a.W("Base64") even across newlines
    tryExtract(/(?:[\w_]+\.[\w_]+|\(\s*0\s*,\s*[\w_]+\.[\w_]+\))\s*\(\s*["']([A-Za-z0-9+/=]{50,})["']/g);

    // v2.0 pattern 2: Generic fallback to extract any large Base64 string that might be a protobuf descriptor
    // This is necessary because formatting the JS bundle with line breaks might break strict AST-like regexes.
    tryExtract(/(?:^|[^\w])(?:'|")([A-Za-z0-9+/=]{100,})(?:'|")/g);

    return results;
}

/**
 * 抽出結果のサマリーを標準出力に表示する。
 */
export function printExtractionSummary(descriptors: ExtractedDescriptor[]): void {
    console.log(`\n── Extracted ${descriptors.length} descriptors ──\n`);

    for (const d of descriptors) {
        const p = d.proto;
        const msgs = p.messageType.length;
        const enums = p.enumType.length;
        const svcs = p.service.length;
        const svcTag = svcs > 0 ? ` [SVC:${svcs}]` : "";
        console.log(`  ${p.name}  msgs:${msgs} enums:${enums} deps:${p.dependency.length}${svcTag}`);
    }

    console.log();
}
