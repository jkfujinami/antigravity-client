/**
 * 発話ゲート出力パーサ（sys_json）。
 *
 * 方針: 終端フェンス ``` に依存しない。sys_json マーカ以降で最初の「バランスした JSON オブジェクト」を
 * 文字列状態(inString/escape)を尊重しながら波括弧マッチで抜く。→ message 内に ``` が何個入れ子でも無関係。
 */

export interface GateDecision {
  surface: boolean;
  priority: "low" | "med" | "high";
  needs_confirm: boolean;
  escalate: boolean;
  message: string;
}

/** s の from 以降で最初のバランスした {…} を JSON.parse。文字列・エスケープを尊重。 */
function scanBalancedJson(s: string, from: number): any | null {
  let start = s.indexOf("{", from);
  while (start >= 0) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        if (--depth === 0) {
          const cand = s.slice(start, i + 1);
          try { return JSON.parse(cand); }
          catch {
            const rep = tryRepair(cand);
            if (rep) return rep;
            break; // この { は不良。次の { から再挑戦
          }
        }
      }
    }
    start = s.indexOf("{", start + 1);
  }
  return null;
}

/** 軽微な壊れ（末尾カンマ）だけ直して再パース。過剰修復はしない。 */
function tryRepair(s: string): any | null {
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, "$1")); } catch { return null; }
}

/**
 * 生 Text から sys_json ペイロードを抽出。
 * 1) ```(3個以上)sys_json マーカ以降で最初のバランス JSON
 * 2) マーカ無し → 全文で最初のバランス JSON（素JSON / ```json フェンス両対応）
 * 見つからなければ null。
 */
export function extractSysJson(text: string): any | null {
  const marker = /`{3,}\s*sys_json/i.exec(text);
  if (marker) {
    const j = scanBalancedJson(text, marker.index + marker[0].length);
    if (j) return j;
  }
  return scanBalancedJson(text, 0);
}

/**
 * 発話ゲート判定。パース成功→正規化。
 * 失敗時フェイルセーフ: 生Textが非空なら {surface:true, message:生Text} で「喋らせる」。
 */
export function parseGateOutput(text: string): GateDecision {
  const raw = extractSysJson(text);
  if (raw && typeof raw === "object") {
    return {
      surface: raw.surface === true,
      priority: ["low", "med", "high"].includes(raw.priority) ? raw.priority : "med",
      needs_confirm: raw.needs_confirm === true,
      escalate: raw.escalate === true,
      message: typeof raw.message === "string" ? raw.message : "",
    };
  }
  // フェイルセーフ: 構造は取れないが何か言っている → 落とすより喋る
  const stripped = text.replace(/`{3,}[a-z_]*\s*/gi, "").trim();
  return { surface: stripped.length > 0, priority: "med", needs_confirm: false, escalate: false, message: stripped };
}
