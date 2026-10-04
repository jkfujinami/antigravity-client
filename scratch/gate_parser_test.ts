import { parseGateOutput, extractSysJson } from "./gate_parser.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : "  <<< " + detail}`);
  cond ? pass++ : fail++;
}

// 1) 通常
{
  const t = '```sys_json\n{"surface": true, "priority": "high", "needs_confirm": true, "escalate": false, "message": "ディスク残8%"}\n```';
  const d = parseGateOutput(t);
  check("1 通常", d.surface === true && d.priority === "high" && d.message === "ディスク残8%", JSON.stringify(d));
}

// 2) フェンス外に思考の散文（前後）
{
  const t = '状況を評価します。緊急性は低いですが通知します。\n```sys_json\n{"surface": true, "priority":"med","needs_confirm":false,"escalate":false,"message":"バッテリー15%"}\n```\n以上です。';
  const d = parseGateOutput(t);
  check("2 前後に散文", d.surface === true && d.message === "バッテリー15%", JSON.stringify(d));
}

// 3) ★ message 内に ``` コードフェンスが入れ子
{
  const t = '```sys_json\n{"surface": true, "priority":"high","needs_confirm":false,"escalate":true,"message":"クラッシュ検出。ログ:\\n```js\\nthrow new Error(\\"x\\")\\n``` を確認して"}\n```';
  const d = parseGateOutput(t);
  check("3 message内に```入れ子", d.surface === true && d.message.includes("```js") && d.message.includes('throw new Error("x")'), JSON.stringify(d));
}

// 4) message 内に波括弧と閉じ括弧
{
  const t = '```sys_json\n{"surface":true,"priority":"low","needs_confirm":false,"escalate":false,"message":"設定 {a: 1, b: {c: 2}} が壊れています"}\n```';
  const d = parseGateOutput(t);
  check("4 message内に{ }", d.surface === true && d.message === "設定 {a: 1, b: {c: 2}} が壊れています", JSON.stringify(d));
}

// 5) 4連バッククォートの外側フェンス
{
  const t = '````sys_json\n{"surface":false,"priority":"low","needs_confirm":false,"escalate":false,"message":""}\n````';
  const d = parseGateOutput(t);
  check("5 ````4連", d.surface === false && d.message === "", JSON.stringify(d));
}

// 6) フェンス無しの素JSON
{
  const t = '{"surface": true, "priority":"med","needs_confirm":true,"escalate":false,"message":"通知"}';
  const d = parseGateOutput(t);
  check("6 素JSON", d.surface === true && d.needs_confirm === true, JSON.stringify(d));
}

// 7) sys_json 無し → ```json フォールバック
{
  const t = 'はい。\n```json\n{"surface": true, "priority":"high","needs_confirm":false,"escalate":false,"message":"SSDエラー"}\n```';
  const d = parseGateOutput(t);
  check("7 ```json フォールバック", d.surface === true && d.message === "SSDエラー", JSON.stringify(d));
}

// 8) ネストされたJSONオブジェクト（深さ>1）
{
  const t = '```sys_json\n{"surface":true,"priority":"high","needs_confirm":false,"escalate":false,"message":"x","extra":{"a":{"b":1}}}\n```';
  const d = parseGateOutput(t);
  check("8 深いネスト", d.surface === true && d.message === "x", JSON.stringify(d));
}

// 9) 末尾カンマ（軽微修復）
{
  const t = '```sys_json\n{"surface":true,"priority":"low","needs_confirm":false,"escalate":false,"message":"a",}\n```';
  const d = parseGateOutput(t);
  check("9 末尾カンマ修復", d.surface === true && d.message === "a", JSON.stringify(d));
}

// 10) 完全に壊れてる → フェイルセーフで喋る
{
  const t = '警告: ディスクがいっぱいです。今すぐ確認してください。';
  const d = parseGateOutput(t);
  check("10 フェイルセーフ(非JSON→喋る)", d.surface === true && d.message.includes("ディスク"), JSON.stringify(d));
}

// 11) 空 → 沈黙
{
  const d = parseGateOutput("");
  check("11 空→沈黙", d.surface === false, JSON.stringify(d));
}

// 12) 沈黙時にゴミ "." だけ → JSON無し・非空だが…（フェイルセーフは喋る側に倒す想定）
{
  const d = parseGateOutput(".");
  check("12 '.'のみ", d.surface === true && d.message === ".", "（フェイルセーフは安全側=喋る。呼び出し側で長さ閾値を足すか検討）");
}

// 13) surface のみ true、他フィールド欠落 → デフォルト補完
{
  const t = '```sys_json\n{"surface": true, "message":"最小"}\n```';
  const d = parseGateOutput(t);
  check("13 欠落フィールド補完", d.surface === true && d.priority === "med" && d.escalate === false, JSON.stringify(d));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
