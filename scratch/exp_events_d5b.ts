/**
 * D5b: send_message ツール経路を明示的に強制して step:sendMessage が発火するか確認。
 * さらに「沈黙 vs 発話」を Text をカーネルがゲートする方式が現実的かも見る。
 */
import { AntigravityClient } from "../src/index.js";
import { CascadeEvents } from "../src/types/events.js";

async function run(prompt: string, label: string) {
  const client = await AntigravityClient.connect({ autoDetect: true });
  const cascade = await client.startCascade();
  const steps = new Map<string, number>();
  const sendMsg: any[] = [];
  let text = "", thinking = 0;

  cascade.on(CascadeEvents.StepNew, (ev: any) => {
    steps.set(ev.step.type, (steps.get(ev.step.type) ?? 0) + 1);
  });
  cascade.on(CascadeEvents.Text, (ev: any) => { text = ev.fullText ?? text; });
  cascade.on(CascadeEvents.Thinking, () => { thinking++; });
  cascade.on("step:sendMessage", (ev: any) => {
    sendMsg.push(ev);
    console.log(`  🔔 step:sendMessage #${ev.step?.index}:`, JSON.stringify(ev.step?.value)?.slice(0, 300));
  });

  console.log(`\n===== ${label} =====\n> ${prompt}`);
  await cascade.sendMessage(prompt);
  await new Promise<void>((r) => {
    const to = setTimeout(r, 40000);
    cascade.on("done", () => { clearTimeout(to); setTimeout(r, 1200); });
  });
  console.log("  steps:", Object.fromEntries(steps));
  console.log("  text :", JSON.stringify(text.slice(0, 120)));
  console.log("  thinking events:", thinking, "| step:sendMessage:", sendMsg.length);
  cascade.dispose();
}

async function main() {
  // 明示的に send_message ツールを使えと指示
  await run(
    "send_message ツールを使って、ユーザーに『テスト通知』とだけ送ってください。テキスト応答ではなくツール呼び出しで。",
    "A: send_message ツール強制"
  );
  process.exit(0);
}
main().catch(e => { console.error("ERR", e); process.exit(1); });
