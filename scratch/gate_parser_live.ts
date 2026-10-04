/** 実モデル出力を parseGateOutput に通す統合確認。message内にコードフェンスを誘発。 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";
import { parseGateOutput } from "./gate_parser.js";

async function ask(client: AntigravityClient, prompt: string): Promise<string> {
  const c = await client.startCascade();
  let text = "";
  c.on(CascadeEvents.Text, (e: any) => { text = e.fullText ?? text; });
  await c.sendMessage(prompt);
  await new Promise<void>((r) => { const to = setTimeout(r, 35000); c.on("done", () => { clearTimeout(to); setTimeout(r, 600); }); });
  c.dispose();
  return text.trim();
}

const P = (sit: string) =>
  'あなたは常駐トリアージ。判定を ```sys_json``` フェンス内のJSONで返せ。\n' +
  'スキーマ: {"surface":bool,"priority":"low"|"med"|"high","needs_confirm":bool,"escalate":bool,"message":string}\n' +
  '**message には該当する生ログ/コードを ```lang ... ``` のコードフェンス付きで引用すること**（入れ子）。\n\n状況: ' + sit;

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const sits = [
    'アプリがクラッシュ。ログ: TypeError: cannot read property "id" of undefined (app.js:42)',
    'ビルド失敗。エラー: `error TS2345: Argument of type string is not assignable`',
  ];
  for (const s of sits) {
    const out = await ask(client, P(s));
    const d = parseGateOutput(out);
    console.log("\n===== 状況:", s.slice(0, 30), "=====");
    console.log("RAW len:", out.length, "| 内側``` 個数:", (out.match(/```/g) || []).length);
    console.log("parsed:", JSON.stringify({ surface: d.surface, priority: d.priority, esc: d.escalate }));
    console.log("message:", JSON.stringify(d.message.slice(0, 180)));
    console.log("→ message にコードフェンス保持:", d.message.includes("```") ? "✅" : "（フェンス無しで返した）");
  }
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
