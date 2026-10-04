/**
 * 複数タグ版の発話ゲートを実測:
 *  発話時 → ```say``` + ```priority``` + ```confirm``` が揃うか
 *  沈黙時 → say ブロックを出さない(=沈黙)か
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

function tag(s: string, name: string): string | null {
  const m = s.match(new RegExp("```" + name + "\\s*([\\s\\S]*?)```", "i"));
  return m ? m[1].trim() : null;
}

const RULES =
  "あなたは常駐アシスタントのトリアージ。状況を評価し、ユーザーに伝えるべき時だけ以下のタグで出力せよ。\n" +
  "- 伝える必要がある時: ```say``` に発話文を入れる。任意で ```priority``` (low|med|high)、```confirm``` (yes|no) を添える。\n" +
  "- 伝える必要が無い時: **何も出力しない**（sayブロックを出さない）。\n" +
  "- タグ以外の説明文は書かない。\n\n状況: ";

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const cases: [string, string][] = [
    ["SPEAK", "ディスク残り8%。~/Library/Logs が12GB に自動肥大。ユーザー操作ではない。"],
    ["SILENT", "ユーザーがブラウザで動画視聴中、CPU 70%。通常の使用範囲。"],
    ["SPEAK2", "外付けSSDが書き込みエラーを断続的に返し始めた。データ破損の恐れ。"],
  ];
  for (const [label, sit] of cases) {
    const out = await ask(client, RULES + sit);
    console.log(`\n===== ${label} =====`);
    console.log("RAW:", JSON.stringify(out.slice(0, 300)));
    const say = tag(out, "say"), pri = tag(out, "priority"), conf = tag(out, "confirm");
    if (say === null) {
      console.log(out === "" ? "→ ✅ 沈黙(出力なし)" : `→ ⚠ sayなしだが余分な出力 ${out.length}字`);
    } else {
      console.log(`→ 発話: "${say.slice(0,60)}" | priority=${pri} confirm=${conf}`);
    }
  }
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
