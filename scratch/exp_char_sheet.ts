/** 同一キャラの[閉口|開口]を横並び1枚(スプライトシート)で生成して保存。 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";
import { copyFileSync, existsSync } from "fs";

const OUT = "/private/tmp/claude-501/-Users-fujinami-github-antigravity-client/d8dfb2ec-af67-4c8e-84fe-81d67363719f/scratchpad";

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const c = await client.startCascade();
  c.on(CascadeEvents.Interaction, (e: any) => { try { e.approve?.(); } catch {} });

  const prompt =
    "generate_image ツールで、アスペクト比 2:1 の画像を1枚生成して。内容: " +
    "1体の同じアニメ調ナレーターキャラクター（若い男性、青いジャケット、短い黒髪、正面向き、バストアップ）を、" +
    "左右に2フレーム並べる。左フレーム=口を完全に閉じている。右フレーム=口を大きく開けて喋っている。" +
    "2つのフレームは口以外は完全に同一（同じ服・髪・姿勢・位置・表情）。背景は真っ白。左右フレームの間に細い区切りの余白。";
  console.log("send sheet gen...");
  await c.sendMessage(prompt);
  await new Promise<void>((r) => { const to = setTimeout(r, 100000); c.on("done", () => { clearTimeout(to); setTimeout(r, 2000); }); });

  const steps = (c.state as any)?.trajectory?.steps ?? [];
  for (const s of steps) {
    let js: any; try { js = s.toJson(); } catch { continue; }
    const gi = js?.generateImage; if (!gi) continue;
    const uri: string = gi.generatedMedia?.uri || "";
    const p = uri.replace(/^file:\/\//, "");
    console.log("uri:", uri);
    if (existsSync(p)) {
      const dst = `${OUT}/sheet_talk.jpg`;
      copyFileSync(p, dst);
      console.log("💾 saved sheet:", dst, "ar:", gi.aspectRatio, "model:", gi.modelName);
    } else console.log("⚠ file not found:", p);
  }
  c.dispose();
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
