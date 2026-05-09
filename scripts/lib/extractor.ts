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

/**
 * JS バンドルファイルから全ての Protobuf ディスクリプタを抽出する。
 *
 * @param bundlePath フォーマット済み JS バンドルへのパス
 * @returns 抽出・デコード済みのディスクリプタ配列
 */
export function extractDescriptors(bundlePath: string): ExtractedDescriptor[] {
    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Bundle not found: ${bundlePath}`);
    }

    const content = fs.readFileSync(bundlePath, "utf8");

    // Rl("Base64", [...deps]) パターンを検索
    // 最低50文字以上の Base64 を対象にし、短いノイズを除外
    const regex = /Rl\s*\(\s*"([A-Za-z0-9+/=]{50,})"/g;
    const results: ExtractedDescriptor[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
        const b64 = match[1];
        const offset = match.index;

        try {
            const binary = Buffer.from(b64, "base64");
            const proto = FileDescriptorProto.fromBinary(binary);

            // name フィールドが存在しないものはスキップ
            if (!proto.name) continue;

            results.push({ proto, rawBase64: b64, offset });
        } catch {
            // FileDescriptorProto としてパースできないものはスキップ
        }
    }

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
