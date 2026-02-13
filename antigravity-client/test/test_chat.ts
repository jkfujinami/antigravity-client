
import { AntigravityClient } from "../src/client.js";

async function main() {
  try {
    console.log("🔌 Connecting...");
    const client = await AntigravityClient.connect();
    console.log("✅ Connected.");

    console.log("🚀 Starting new cascade...");
    const cascade = await client.startCascade();
    console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

    // Listen to updates
    cascade.on("text", (ev) => {
        process.stdout.write(ev.delta);
    });

    cascade.on("thinking", (ev) => {
        process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`);
    });

    cascade.on("error", (err) => {
        console.error("\n❌ Cascade Error:", err);
    });

    console.log("📨 Sending message...");
    const msg = "Whoamiを実行してほしい.";
    await cascade.sendMessage(msg);
    console.log("\n✅ Message sent.");

    // Keep process alive for longer to see the AI response
    await new Promise(r => setTimeout(r, 60000));

  } catch (e) {
    console.error("❌ Chat Error:", e);
  }
}

function extractStrings(diff: any, path = ""): {path: string, value: string}[] {
  const results: any[] = [];
  if (!diff || !diff.fieldDiffs) return results;
  for (const fd of diff.fieldDiffs) {
    const fp = `${path}.f${fd.fieldNumber}`;
    const d = fd.diff;
    if (d.case === "updateSingular") {
      const sv = d.value;
      if (sv.value?.case === "stringValue") {
        results.push({ path: fp, value: sv.value.value });
      } else if (sv.value?.case === "messageValue") {
        results.push(...extractStrings(sv.value.value, fp + ".msg"));
      }
    } else if (d.case === "updateRepeated") {
      const rd = d.value;
      for (let i = 0; i < (rd.updateValues?.length || 0); i++) {
        const sv = rd.updateValues[i];
        const idx = rd.updateIndices?.[i] ?? i;
        const rp = `${fp}[${idx}]`;
        if (sv.value?.case === "stringValue") {
          results.push({ path: rp, value: sv.value.value });
        } else if (sv.value?.case === "messageValue") {
          results.push(...extractStrings(sv.value.value, rp + ".msg"));
        }
      }
    }
  }
  return results;
}

main();
