/** generatedMedia.uri の中身を暴き、実バイトを保存する。 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";
import { writeFileSync, existsSync, copyFileSync } from "fs";

const OUT = "/private/tmp/claude-501/-Users-fujinami-github-antigravity-client/d8dfb2ec-af67-4c8e-84fe-81d67363719f/scratchpad";

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const c = await client.startCascade();
  c.on(CascadeEvents.Interaction, (e: any) => { try { e.approve?.(); } catch {} });

  await c.sendMessage("generate_image ツールで、青い三角形だけのシンプルな画像を1枚生成して。");
  await new Promise<void>((r) => { const to = setTimeout(r, 90000); c.on("done", () => { clearTimeout(to); setTimeout(r, 2000); }); });

  const steps = (c.state as any)?.trajectory?.steps ?? [];
  for (const s of steps) {
    let js: any; try { js = s.toJson(); } catch { continue; }
    const gi = js?.generateImage;
    if (!gi) continue;
    console.log("=== generateImage ===");
    console.log("model:", gi.modelName, "ar:", gi.aspectRatio, "name:", gi.imageName);
    const media = gi.generatedMedia || {};
    console.log("mime:", media.mimeType, "| inlineData len:", (media.inlineData||"").length);
    console.log("URI (full):", media.uri);
    console.log("generatedImage:", JSON.stringify(gi.generatedImage)?.slice(0,120));
    const ext = (media.mimeType||"").includes("jpeg") ? "jpg" : (media.mimeType||"").includes("png") ? "png" : "bin";
    const dst = `${OUT}/gen_${gi.imageName||"img"}.${ext}`;

    const uri: string = media.uri || "";
    try {
      if (media.inlineData) {
        writeFileSync(dst, Buffer.from(media.inlineData, "base64")); console.log("💾 from inlineData:", dst);
      } else if (uri.startsWith("data:")) {
        const b64 = uri.split(",")[1]; writeFileSync(dst, Buffer.from(b64, "base64")); console.log("💾 from data-uri:", dst);
      } else if (uri.startsWith("file://") || uri.startsWith("/")) {
        const p = uri.replace(/^file:\/\//, "");
        console.log("local path exists?", existsSync(p));
        if (existsSync(p)) { copyFileSync(p, dst); console.log("💾 copied local:", dst); }
      } else if (uri.startsWith("http")) {
        const res = await fetch(uri); const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(dst, buf); console.log("💾 fetched http:", dst, buf.length, "bytes");
      } else {
        console.log("⚠ 未知のURIスキーム:", uri.slice(0, 40));
      }
    } catch (e) { console.log("save err:", e); }
  }
  c.dispose();
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
