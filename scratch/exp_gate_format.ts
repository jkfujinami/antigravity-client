/**
 * 発話ゲートの出力形式比較:
 *  (A) 素のJSON {surface, message}
 *  (B) ```say フェンスに発話だけ入れる（無ければ沈黙）
 *  (C) NOOP センチネル
 * それぞれ「発話すべき」ケースと「沈黙すべき」ケースで、Text がパース可能かを見る。
 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";

async function ask(client: AntigravityClient, prompt: string): Promise<string> {
  const cascade = await client.startCascade();
  let text = "";
  cascade.on(CascadeEvents.Text, (e: any) => { text = e.fullText ?? text; });
  await cascade.sendMessage(prompt);
  await new Promise<void>((r) => {
    const to = setTimeout(r, 35000);
    cascade.on("done", () => { clearTimeout(to); setTimeout(r, 800); });
  });
  cascade.dispose();
  return text.trim();
}

const SITUATION_SPEAK =
  "状況: ディスク残り8%。~/Library/Logs が12GB に肥大。ユーザー操作ではなく自動ログ肥大が原因らしい。";
const SITUATION_SILENT =
  "状況: ユーザーがブラウザで動画視聴中、CPU 70%。通常の使用範囲。";

function tryJson(s: string) {
  // 素のJSON or ```json フェンス両対応で試す
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : s;
  try { return JSON.parse(raw.trim()); } catch { return null; }
}
function extractSay(s: string) {
  const m = s.match(/```say\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : null;
}

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });

  const A = (sit: string) =>
    `あなたは常駐アシスタントのトリアージ。次の状況を評価し、ユーザーに通知すべきか判断せよ。\n` +
    `出力は**厳密にJSONのみ**。マークダウンや説明を一切付けず、次の形だけ返せ:\n` +
    `{"surface": <true|false>, "message": "<通知文。surfaceがfalseなら空文字>"}\n\n状況: ${sit}`;
  const B = (sit: string) =>
    `あなたは常駐アシスタントのトリアージ。ユーザーに伝える必要がある時だけ、その発話を \`\`\`say と \`\`\` で囲んで出せ。\n` +
    `伝える必要が無ければ何も出さない（空でよい）。sayブロック以外の説明文は禁止。\n\n状況: ${sit}`;
  const C = (sit: string) =>
    `あなたは常駐アシスタントのトリアージ。ユーザーに伝える必要が無ければ \`NOOP\` とだけ出せ。\n` +
    `伝える必要がある時は通知文だけを出せ（前置き禁止）。\n\n状況: ${sit}`;

  for (const [name, fn, sit, expect] of [
    ["A-JSON / SPEAK", A, SITUATION_SPEAK, "surface:true"],
    ["A-JSON / SILENT", A, SITUATION_SILENT, "surface:false"],
    ["B-FENCE / SPEAK", B, SITUATION_SPEAK, "say block"],
    ["B-FENCE / SILENT", B, SITUATION_SILENT, "empty"],
    ["C-NOOP / SPEAK", C, SITUATION_SPEAK, "message"],
    ["C-NOOP / SILENT", C, SITUATION_SILENT, "NOOP"],
  ] as [string, (s: string) => string, string, string][]) {
    const out = await ask(client, fn(sit));
    console.log(`\n===== ${name}  (期待: ${expect}) =====`);
    console.log("RAW:", JSON.stringify(out.slice(0, 260)));
    if (name.startsWith("A")) {
      const j = tryJson(out);
      console.log("→ parse:", j ? `✅ surface=${j.surface} msg=${JSON.stringify((j.message||"").slice(0,50))}` : "❌ JSON.parse失敗");
    } else if (name.startsWith("B")) {
      const say = extractSay(out);
      console.log("→ say抽出:", say === null ? (out === "" ? "✅ 空(沈黙)" : `⚠ sayブロック無し / 余分な出力: ${out.length}字`) : `✅ "${say.slice(0,50)}"`);
    } else {
      console.log("→ NOOP判定:", /^NOOP\b/i.test(out) ? "✅ NOOP(沈黙)" : `発話扱い: "${out.slice(0,50)}"`);
    }
  }
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
