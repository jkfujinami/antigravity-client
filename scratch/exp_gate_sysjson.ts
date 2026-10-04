/**
 * ```sys_json``` 専用フェンスで JSON を括らせる方式の検証。
 * 一意タグで抽出 → JSON.parse。周辺の散文/思考漏れは無視できるか、構造は保てるか。
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
  'あなたは常駐アシスタントのトリアージ。状況を評価し、判定を **```sys_json と ``` で囲んだJSON** として出力せよ。\n' +
  'sys_json ブロックの中身は次のスキーマの JSON のみ:\n' +
  '{"surface": <boolean>, "priority": "low"|"med"|"high", "needs_confirm": <boolean>, "escalate": <boolean>, "message": "<通知文。surfaceがfalseなら空文字>"}\n' +
  'ブロックの外に説明を書いてもよいが、機械はsys_jsonブロックだけを読む。\n\n状況: ';

const SITUATIONS: [string, boolean][] = [
  ["ディスク残り8%。~/Library/Logs が12GBに自動肥大。ユーザー操作ではない。", true],
  ["ユーザーがブラウザで動画視聴中、CPU 70%。通常の使用範囲。", false],
  ["外付けSSDが書き込みエラーを断続的に返し始めた。データ破損の恐れ。", true],
  ["バッテリー残り15%、電源未接続。あと20分ほどで切れる見込み。", true],
  ["ユーザーは3時間アイドル。カレンダーに「15:00 歯医者」の予定、現在14:55。", true],
  ["既知のビルドプロセス(webpack)がCPU 90%。ユーザーが今npm run buildを実行した直後。", false],
  ["見覚えのないプロセス 'kdcupd' が起動し、外部IPへ断続的に通信している。", true],
  ["新しいWi-Fi 'HomeNet' に接続した（自宅の既知ネットワーク）。", false],
  ['アプリがクラッシュしログに `Error: cannot read property "id" of undefined` が大量に出ている。', true],
  ["メモリ圧が critical、スワップが急増。Chromeのタブが80個開いている。", true],
  ["時刻が深夜3時。ユーザーはまだタイピング中でアクティブ。", false],
  ["Time Machineバックアップが5日間失敗し続けている。", true],
];

function extractSysJson(s: string): { found: boolean; parsed: any | null } {
  const m = s.match(/```sys_json\s*([\s\S]*?)```/i);
  if (!m) return { found: false, parsed: null };
  try { return { found: true, parsed: JSON.parse(m[1].trim()) }; }
  catch { return { found: true, parsed: null }; }
}

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const RUNS = 2;
  let total = 0, tagFound = 0, parseOk = 0, schemaOk = 0, surfaceMatch = 0, proseOutside = 0;
  const fails: string[] = [];

  for (let run = 1; run <= RUNS; run++) {
    for (const [sit, expectSpeak] of SITUATIONS) {
      total++;
      const out = await ask(client, SCHEMA + sit);
      const { found, parsed } = extractSysJson(out);
      if (found) tagFound++;
      if (parsed) parseOk++;
      // ブロック外に文字があるか（=散文漏れ、ただし無視できるので許容）
      const outside = out.replace(/```sys_json[\s\S]*?```/i, "").trim();
      if (outside.length > 0) proseOutside++;
      const schemaGood = !!parsed && typeof parsed.surface === "boolean" && "message" in parsed &&
        ["low","med","high",undefined].includes(parsed.priority);
      if (schemaGood) schemaOk++;
      if (parsed && parsed.surface === expectSpeak) surfaceMatch++;
      const flag = !found ? "❌NOTAG" : !parsed ? "❌PARSE" : !schemaGood ? "⚠SCHEMA" : (parsed.surface !== expectSpeak ? "⚠JUDGE" : "");
      if (flag) fails.push(`[${flag}] (${sit.slice(0,22)}) out=${JSON.stringify(out.slice(0,160))}`);
      console.log(`r${run} ${flag||"✅"} surf=${parsed?.surface} pri=${parsed?.priority} esc=${parsed?.escalate} outside=${outside.length}b`);
    }
  }

  console.log("\n══════ SUMMARY (sys_json fence) ══════");
  console.log(`総数            : ${total}`);
  console.log(`sys_jsonタグ検出: ${tagFound}/${total} (${(tagFound/total*100).toFixed(0)}%)`);
  console.log(`parse成功       : ${parseOk}/${total} (${(parseOk/total*100).toFixed(0)}%)`);
  console.log(`スキーマ準拠    : ${schemaOk}/${total} (${(schemaOk/total*100).toFixed(0)}%)`);
  console.log(`surface判定一致 : ${surfaceMatch}/${total} (${(surfaceMatch/total*100).toFixed(0)}%)`);
  console.log(`ブロック外に散文: ${proseOutside}/${total} (無視可)`);
  if (fails.length) { console.log("\n--- 問題ケース ---"); fails.forEach(f => console.log(f)); }
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
