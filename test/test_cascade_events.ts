/**
 * cascade.on() を利用して、Cascade から発行される各種イベントを捕捉・検証するテスト
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

        console.log("📡 Registering event listeners (cascade.on)...");

        // テキストチャンクの受信
        cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
            process.stdout.write(ev.delta);
        });

        // 思考プロセスチャンクの受信
        cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => {
            process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`);
        });

        // エラーの受信
        cascade.on(Cascade.Events.Error, (err: any) => {
            console.error("\n❌ [Event: Error] ", err);
        });

        // 実行完了イベントの受信
        cascade.on(Cascade.Events.Done, () => {
            console.log("\n✅ [Event: Done] Cascade stream has naturally ended.");
        });

        const msg = "自己紹介をしてください。思考プロセス（Thinking）を含めて短めにお願いします。";
        console.log(`\n📨 Sending message: "${msg}"`);
        console.log("--------------------------------------------------");
        
        // メッセージ送信（今回はストリーム完了まで待つために cascade.run を使うが、
        // 内部でイベントが正しく発火し、RunCompleted が呼ばれるかをテストする）
        await cascade.run(msg, { timeoutMs: 60000 });
        
        console.log("--------------------------------------------------");
        console.log("🏁 Test completed cleanly.");
        
        client.dispose();
    } catch (e: unknown) {
        console.error("\n❌ Test failed:", (e as Error).message);
    }
}

main();
