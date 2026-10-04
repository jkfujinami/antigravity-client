/**
 * D5 検証: sendMessage → イベントで「思考 / 本文 / 発話(send_message)」を切り分けて取れるか。
 * run() を使わず、listen()+on() だけで受ける。
 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";

async function main() {
  const client = await AntigravityClient.connect({ autoDetect: true });
  console.log("✅ connected");
  const cascade = await client.startCascade(); // listen() は内部で自動起動
  console.log("cascadeId:", cascade.cascadeId, "\n");

  const seenStepTypes = new Map<string, number>();
  let thinkingChars = 0, textChars = 0;
  const sendMessageSteps: any[] = [];
  let thinkingSample = "", textSample = "";

  cascade.on(CascadeEvents.StepNew, (ev: any) => {
    const t = ev.step.type;
    seenStepTypes.set(t, (seenStepTypes.get(t) ?? 0) + 1);
    console.log(`[stepNew] #${ev.step.index} ${t} (${ev.step.status})`);
  });

  cascade.on(CascadeEvents.Thinking, (ev: any) => {
    thinkingChars += ev.delta?.length ?? 0;
    thinkingSample = ev.fullText ?? thinkingSample;
  });

  cascade.on(CascadeEvents.Text, (ev: any) => {
    textChars += ev.delta?.length ?? 0;
    textSample = ev.fullText ?? textSample;
  });

  // 本命: send_message ツール発火 = 発話の窓口
  cascade.on("step:sendMessage", (ev: any) => {
    sendMessageSteps.push(ev);
    console.log(`[step:sendMessage] 🔔 発話検出! #${ev.step?.index} status=${ev.step?.status}`);
    try {
      console.log("   value keys:", Object.keys(ev.step?.value ?? {}));
      console.log("   value:", JSON.stringify(ev.step?.value)?.slice(0, 400));
    } catch {}
  });

  cascade.on(CascadeEvents.StatusChange, (ev: any) =>
    console.log(`[status] ${ev.previousStatus} -> ${ev.status}`));

  const prompt = "「準備完了」とだけユーザーに伝えて。余計な説明は不要。";
  console.log("📨 send:", prompt, "\n");
  await cascade.sendMessage(prompt);

  await new Promise<void>((resolve) => {
    const to = setTimeout(() => { console.log("\n⏰ 45s timeout"); resolve(); }, 45000);
    cascade.on("done", () => { clearTimeout(to); setTimeout(resolve, 1500); });
  });

  console.log("\n══════ RESULT ══════");
  console.log("step types seen:", Object.fromEntries(seenStepTypes));
  console.log("thinking chars:", thinkingChars, thinkingChars ? `(sample: ${JSON.stringify(thinkingSample.slice(0,80))})` : "");
  console.log("text chars    :", textChars, textChars ? `(sample: ${JSON.stringify(textSample.slice(0,80))})` : "");
  console.log("step:sendMessage fired:", sendMessageSteps.length, "回");
  console.log("→ 発話を思考/本文と切り分けて取れたか:",
    sendMessageSteps.length > 0 ? "✅ YES" : "❌ NO (発話はTextに出た可能性)");

  cascade.dispose();
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
