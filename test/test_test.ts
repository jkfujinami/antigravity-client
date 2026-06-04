import { AntigravityClient } from "../src/index.js";
async function main() {
    // IDEが起動したLanguage Serverを自動検出して接続
    const client = await AntigravityClient.launch({
        workspacePath: process.cwd(),
        verbose: true,
    });
    // ユーザー情報取得
    console.log(`LS running (PID: ${client.launcher.pid}, HTTPS: ${client.launcher.httpsPort})`);
    const status = await client.getUserStatus();
    const us = status.userStatus;
    console.log(`Name:  ${us?.name || "N/A"}`);
    console.log(`Email: ${us?.email || "N/A"}`);
    // 終わったら停止
    await client.launcher.stop();
}
main();
