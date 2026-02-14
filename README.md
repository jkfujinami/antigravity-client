# Antigravity Client & SDK Guide

A TypeScript client library and CLI tool for interacting with the **Antigravity Language Server (LS)** using the Connect (gRPC) protocol.

このライブラリは、AI エージェントと直接やり取りするための高レベル API（Cascade, Interaction 承認など）を提供します。本家公式クライアントと同等のプロトコル制御が可能です。

## 1. クイックスタート

### インストールと CLI 起動
```bash
npm install
npm run cli
```

### コマンド
- `/new`: 新しいセッションを開始。
- `/exit`: CLI を終了。
- `/info`: 現在のセッション情報を表示。

---

## 2. ライブラリとしての使用方法 (SDK Guide)

### 接続 (Connection)
`AntigravityClient` は、サーバーの自動検出やセッションの管理を担当します。

```typescript
import { AntigravityClient } from "./src/client.js";

// 自動検出による接続 (ポート番号やトークンを自動で見つけます)
const client = await AntigravityClient.connect({ autoDetect: true });
```

### セッション管理
AI との対話は `Cascade` クラスを通じて行われます。

```typescript
// 新しい対話(Cascade)を開始
const cascade = await client.startCascade("gemini-1.5-pro");

// メッセージ送信
await cascade.sendMessage("こんにちは！");

// 既存のセッションを再開する場合
const existingCascade = client.getCascade("your-cascade-id");
```

---

## 3. 重要メソッドとイベント

### AntigravityClient メソッド
- `getUserStatus()`: ユーザー状態の取得。
- `getModelStatuses()`: 利用可能な AI モデルの取得。
- `startCascade(modelName)`: 新規セッション開始。
- `getCascade(cascadeId)`: セッション再開。

### Cascade メソッド
- `sendMessage(text)`: メッセージを送信。
- `approveCommand(stepIndex, proposed, submitted)`: コマンド実行を承認。`submitted` に実行したい最終コマンドを渡します。
- `approveFilePermission(stepIndex, pathUri, scope)`: ファイル権限を承認。`scope` に `PermissionScope.ONCE` または `CONVERSATION` を指定。
- `cancel()`: 現在の実行を中断。

### イベントリスナー
AI の出力をリアルタイムでキャッチします。

```typescript
cascade.on("text", (ev) => console.log("AI:", ev.delta));
cascade.on("thinking", (ev) => console.log("AI Thinking...", ev.delta));
cascade.on("interaction", (ev) => {
    // 権限確認リクエスト
    if (ev.type === "interaction") {
        console.log("Approval required for:", ev.interaction.interaction.case);
    }
});
```

---

## 4. プロトコルの詳細 (Interaction Echo)

本 SDK は、サーバーからの承認リクエストに対して内容を「復唱（Echo）」して返す設計になっています。
特にコマンド実行の承認では、`proposedCommandLine` と `submittedCommandLine` の両方を正しくセットして返信することで、`input not registered` などのエラーを回避します。

詳細な実装例については `src/repl.ts` を参照してください。

## 5. 開発者向け情報

- `src/client.ts`: クライアントエントリーポイント
- `src/cascade.ts`: セッション/イベント管理
- `src/gen/`: 自動生成された Protocol Buffer 定義
- `src/reactive/apply.ts`: 差分更新（Reactive Diff）の適用ロジック

## License

MIT License
