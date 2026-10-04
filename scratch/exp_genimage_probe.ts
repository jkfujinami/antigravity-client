/** generateImage ステップの実構造を特定する（base64/uri/blobref のどこに画像があるか）。 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";
import { writeFileSync } from "fs";

const OUT = "/private/tmp/claude-501/-Users-fujinami-github-antigravity-client/d8dfb2ec-af67-4c8e-84fe-81d67363719f/scratchpad";

// 長い文字列は [len] に置換して構造だけ見る
function trunc(_k: string, v: any) {
  if (typeof v === "string" && v.length > 80) return `‹str len=${v.length}›`;
  return v;
}

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const c = await client.startCascade();

  c.on(CascadeEvents.Interaction, (e: any) => { try { e.approve?.(); } catch {} });

  await c.sendMessage("generate_image ツールで、赤い円だけのシンプルな画像を1枚生成して。");
  await new Promise<void>((r) => {
    const to = setTimeout(r, 90000);
    c.on("done", () => { clearTimeout(to); setTimeout(r, 2000); });
  });

  const steps = (c.state as any)?.trajectory?.steps ?? [];
  console.log("total steps:", steps.length);
  for (const s of steps) {
    // オブジェクトの oneof case を探す
    const caseName = s?.step?.case ?? s?.stepType?.case ?? "?";
    let js: any = null;
    try { js = typeof s.toJson === "function" ? s.toJson() : s; } catch { js = s; }
    const str = JSON.stringify(js);
    if (/generateImage|generate_image|generatedImage|generated_image|generatedMedia/i.test(str)) {
      console.log("\n===== generateImage step 発見 =====");
      console.log("structure:\n", JSON.stringify(js, trunc, 2).slice(0, 2500));
      // base64 らしき長文字列を探索
      const findLong = (o: any, path = ""): void => {
        if (o && typeof o === "object") for (const k of Object.keys(o)) {
          const v = o[k];
          if (typeof v === "string" && v.length > 500)
            console.log(`  🔎 長文字列: ${path}.${k}  len=${v.length}  head=${v.slice(0,24)}`);
          else if (typeof v === "object") findLong(v, `${path}.${k}`);
        }
      };
      findLong(js);
    }
  }
  c.dispose();
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
