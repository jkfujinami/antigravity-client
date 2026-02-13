# Antigravity Client (日本語)

**Antigravity Language Server (LS)** と Connect (gRPC) プロトコルを使用して通信するための TypeScript クライアントライブラリおよび CLI ツールです。

このライブラリは、チャットセッション（"Cascades"）の管理、コマンド実行、AI エージェントからのリアクティブな更新ストリーミングを行うための高レベル API を提供します。

## 特徴

- **自動検出**: 実行中の Antigravity LS プロセス、ポート、CSRF トークンを自動的に検出します。
- **Cascade 管理**: チャットセッションの開始、再開、および状態の永続化を管理します。
- **リアクティブストリーミング**: AI の思考プロセス、テキスト応答、ツール実行をリアルタイムでストリーミングします。
- **インタラクティブ CLI**: ターミナルから直接エージェントと対話できる組み込みの REPL 環境を含みます。

## 前提条件

- Node.js (v18 以降)
- 実行中の Antigravity Language Server インスタンス（通常は VS Code 拡張機能などのバックグラウンドで動作しています）。

## インストール

```bash
npm install
```

## 使い方

### インタラクティブ CLI

対話型チャットセッションを開始するには、以下のコマンドを実行します：

```bash
npm run cli
```

CLI 内で使用できるコマンド:
- `/new`: 新しいセッションを開始します。
- `/reset`: `/new` と同じです。
- `/exit` または `/quit`: CLI を終了します。
- `/info`: 現在のセッション情報を表示します。

### ライブラリとしての使用方法

`AntigravityClient` を使用して、独自のツールや統合機能を構築できます。

```typescript
import { AntigravityClient } from "./src/client.js";

async function main() {
  // 1. Language Server に接続 (ポートとトークンを自動検出)
  const client = await AntigravityClient.connect({ autoDetect: true });

  // 2. 新しい Cascade (チャットセッション) を開始
  const cascade = await client.startCascade("gemini-3-flash");

  // 3. イベントをリッスン
  cascade.on("text", (event) => {
    process.stdout.write(event.delta);
  });

  cascade.on("thinking", (event) => {
    console.log(`[Thinking]: ${event.delta}`);
  });

  // 4. メッセージを送信
  await cascade.sendMessage("こんにちは、自己紹介してください。");
}

main();
```

## ディレクトリ構成

- `src/`: ライブラリおよび CLI のソースコード。
  - `client.ts`: メインのクライアントエントリーポイント。
  - `cascade.ts`: 個別のチャットセッションを管理します。
  - `repl.ts`: インタラクティブ CLI の実装。
  - `gen/`: 生成された Protocol Buffer 定義。
- `test/`: テストスクリプトおよびサンプルコード。

## ライセンス

ISC
