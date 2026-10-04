/**
 * JSON 発話ゲートのストレステスト: 多様な状況 × 複数回。
 * 測る: 素のJSON.parse成功 / フェンス寛容parse成功 / スキーマ準拠 / 散文混入 / エスケープ崩れ。
 * schema: {surface:boolean, priority:"low"|"med"|"high", needs_confirm:boolean, escalate:boolean, message:string}
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
    cascade.on("done", () => { clearTimeout(to); setTimeout(r, 600); });
  });
  cascade.dispose();
  return text.trim();
}

const SCHEMA =
  'あなたは常駐アシスタントのトリアージ。状況を評価し、**厳密にJSONのみ**で返せ（前後に説明・マークダウン・コードフェンス禁止）。\n' +
  'スキーマ: {"surface": <boolean 通知すべきか>, "priority": "low"|"med"|"high", "needs_confirm": <boolean>, "escalate": <boolean 高度な調査要か>, "message": "<通知文。surfaceがfalseなら空文字>"}\n\n状況: ';

const SITUATIONS: [string, boolean][] = [
  ["ディスク残り8%。~/Library/Logs が12GBに自動肥大。ユーザー操作ではない。", true],
  ["ユーザーがブラウザで動画視聴中、CPU 70%。通常の使用範囲。", false],
  ["外付けSSDが書き込みエラーを断続的に返し始めた。データ破損の恐れ。", true],
  ["バッテリー残り15%、電源未接続。あと20分ほどで切れる見込み。", true],
  ["ユーザーは3時間アイドル。カレンダーに「15:00 歯医者」の予定、現在14:55。", true],
  ["既知のビルドプロセス(webpack)がCPU 90%。ユーザーが今npm run buildを実行した直後。", false],
  ["見覚えのないプロセス 'kdcupd' が起動し、外部IPへ断続的に通信している。", true],
  ["新しいWi-Fi 'Starbucks_Free' に接続した。", false],
  ['アプリがクラッシュしログに `Error: cannot read property "id" of undefined` が大量に出ている。', true],
  ["メモリ圧が critical、スワップが急増。Chromeのタブが80個開いている。", true],
  ["時刻が深夜3時。ユーザーはまだタイピング中でアクティブ。", false],
  ["Time Machineバックアップが5日間失敗し続けている。", true],
];

function fenceTolerant(s: string): any | null {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fence ? fence[1] : s).trim();
  try { return JSON.parse(raw); } catch { return null; }
}

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const RUNS = 2;
  let total = 0, rawOk = 0, tolerOk = 0, schemaOk = 0, hadFence = 0, surfaceMatch = 0;
  const fails: string[] = [];

  for (let run = 1; run <= RUNS; run++) {
    for (const [sit, expectSpeak] of SITUATIONS) {
      total++;
      const out = await ask(client, SCHEMA + sit);
      const hasFence = /```/.test(out);
      if (hasFence) hadFence++;
      let rawParsed: any = null;
      try { rawParsed = JSON.parse(out); rawOk++; } catch {}
      const j = rawParsed ?? fenceTolerant(out);
      if (j) tolerOk++;
      const schemaGood = !!j && typeof j.surface === "boolean" && "message" in j &&
        ["low","med","high",undefined].includes(j.priority);
      if (schemaGood) schemaOk++;
      if (j && j.surface === expectSpeak) surfaceMatch++;
      const flag = !j ? "❌PARSE" : !schemaGood ? "⚠SCHEMA" : (j.surface !== expectSpeak ? "⚠JUDGE" : "");
      if (flag) fails.push(`[${flag}] (${sit.slice(0,24)}) raw=${JSON.stringify(out.slice(0,140))}`);
      console.log(`r${run} ${flag||"✅"} surf=${j?.surface} pri=${j?.priority} conf=${j?.needs_confirm} esc=${j?.escalate} fence=${hasFence}`);
    }
  }

  console.log("\n══════ SUMMARY ══════");
  console.log(`総数            : ${total}`);
  console.log(`素のJSON.parse  : ${rawOk}/${total} (${(rawOk/total*100).toFixed(0)}%)`);
  console.log(`フェンス寛容parse: ${tolerOk}/${total} (${(tolerOk/total*100).toFixed(0)}%)`);
  console.log(`スキーマ準拠    : ${schemaOk}/${total} (${(schemaOk/total*100).toFixed(0)}%)`);
  console.log(`フェンス混入    : ${hadFence}/${total}`);
  console.log(`surface判定一致 : ${surfaceMatch}/${total} (${(surfaceMatch/total*100).toFixed(0)}%)`);
  if (fails.length) { console.log("\n--- 問題ケース ---"); fails.forEach(f => console.log(f)); }
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
