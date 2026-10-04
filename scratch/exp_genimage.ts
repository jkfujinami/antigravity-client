/** generate_image をcascade経由で叩き、base64を取り出してPNG保存できるか最小確認。 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";
import { writeFileSync } from "fs";

const OUT = "/private/tmp/claude-501/-Users-fujinami-github-antigravity-client/d8dfb2ec-af67-4c8e-84fe-81d67363719f/scratchpad";

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const c = await client.startCascade();
  console.log("cascade:", c.cascadeId);

  const saved: string[] = [];
  function tryExtract(step: any, tag: string) {
    if (step?.type !== "generateImage") return;
    let v: any = step.value;
    try { v = step.raw ? step.raw : v; } catch {}
    // toJson 経由が確実（instance accessorがnull返す既知問題）
    let j: any = null;
    try { j = typeof step.toJson === "function" ? step.toJson() : null; } catch {}
    const gi = v?.generatedImage ?? j?.value?.generateImage?.generatedImage ?? j?.generatedImage;
    const b64 = gi?.base64Data ?? gi?.base64_data;
    const mime = gi?.mimeType ?? gi?.mime_type ?? "image/png";
    console.log(`[${tag}] generateImage status=${step.status} prompt=${JSON.stringify((v?.prompt||"").slice(0,40))} model=${v?.modelName} ar=${v?.aspectRatio} b64len=${b64?.length ?? 0}`);
    if (b64 && !saved.includes(step.index)) {
      const ext = mime.includes("jpeg") ? "jpg" : "png";
      const path = `${OUT}/frame_${step.index}.${ext}`;
      writeFileSync(path, Buffer.from(b64, "base64"));
      saved.push(step.index);
      console.log("   💾 saved:", path, Buffer.from(b64, "base64").length, "bytes");
    }
  }

  c.on(CascadeEvents.StepNew, (e: any) => tryExtract(e.step, "new"));
  c.on(CascadeEvents.StepUpdate, (e: any) => tryExtract(e.step, "upd"));
  c.on(CascadeEvents.Interaction, (e: any) => {
    console.log("  [approval]", e.type, e.description?.slice(0, 60), "→ 自動承認");
    try { e.approve?.(); } catch (err) { console.log("approve err", err); }
  });

  const prompt = "generate_image ツールを使って、次の画像を1枚生成して: " +
    "アニメ調のシンプルなナレーターのキャラクター、正面向き、口を閉じている、白背景、バストアップ。";
  console.log("send:", prompt, "\n");
  await c.sendMessage(prompt);

  await new Promise<void>((r) => {
    const to = setTimeout(() => { console.log("\n⏰ 90s timeout"); r(); }, 90000);
    c.on("done", () => { clearTimeout(to); setTimeout(r, 1500); });
  });

  console.log("\n保存枚数:", saved.length);
  c.dispose();
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
