/**
 * メッセージを送信し、その応答（テキストおよび思考プロセス）を
 * リアルタイムでストリーミング受信して画面に表示するテスト
 */
import { AntigravityClient, Cascade } from "../src/index.js";
import type { TextDeltaEvent, ThinkingDeltaEvent } from "../src/types.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("🚀 Starting new cascade...");
        const cascade = await client.startCascade();
        console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

        // ストリーミングイベントの登録
        cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
            process.stdout.write(ev.delta);
        });

        cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => {
            process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`);
        });

        const msg = "自己紹介をしてください。あなたのモデル名も含めて、3行程度でお願いします。<Thinking>...</Thinking>を使って考えてから答えてね。";
        console.log(`📨 Sending message: "${msg}"`);
        console.log("--------------------------------------------------");
        
        // 応答を待機
        await cascade.run(msg, { timeoutMs: 60000 });
        
        console.log("\n--------------------------------------------------");
        console.log("✅ Stream completed.");
        console.log("🏁 Test completed cleanly.");
        
        client.dispose();
    } catch (e: unknown) {
        console.error("\n❌ Test failed:", (e as Error).message);
    }
}

main();
