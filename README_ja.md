<div align="center">

# Antigravity Client

**[Antigravity](https://antigravity.dev) Language Server の非公式 TypeScript クライアント & CLI**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

*ConnectRPC 経由で Language Server バイナリと直接通信。IDE 不要で動作可能。*

[English README](README.md)

</div>

---

## これは何？

**Antigravity Language Server (LS)** の Go バイナリと、ConnectRPC (gRPC-Web) プロトコルで直接通信するスタンドアロンの TypeScript ライブラリです。IDE のフロントエンドコードをリバースエンジニアリングし、元の Protobuf スキーマを再構築することで開発されました。

公式 SDK（VS Code Extension API を通じて IDE を拡張するもの）とは異なり、このプロジェクトは LS プロセスそのものと通信します。すべての RPC メソッド、すべての Protobuf メッセージ、すべてのストリーミングエンドポイントに制限なくアクセスできます。

> [!IMPORTANT]
> これは VS Code 拡張機能 SDK では**ありません**。ConnectRPC 経由で Language Server バイナリと直接通信する低レベルクライアントライブラリです。IDE が起動していなくても動作します。

---

## クイックスタート

```bash
npm install github:jkfujinami/antigravity-client
```

```typescript
import { AntigravityClient } from "antigravity-client";

const client = await AntigravityClient.connect();
const status = await client.getUserStatus();
console.log(`接続完了: ${status.userStatus?.name}`);
```

---

## 機能

### Language Server との直接通信

SDK は LS のサービス定義から抽出した **188 の RPC メソッド** すべてをラップする型安全な `LanguageServerFacade` を公開します。各メソッドは完全に型付けされた Protobuf メッセージを受け取り、返却します。

```typescript
const client = await AntigravityClient.connect();

// 188 の RPC メソッドを直接呼び出し
const response = await client.languageServer.acceptTermsOfService({ metadata });
const models   = await client.languageServer.getCascadeModelConfigs({ metadata });
const mcpState = await client.languageServer.getMcpServerStates({});

// 便利なラッパーメソッドも利用可能
const userStatus = await client.getUserStatus();
```

> [!NOTE]
> ファサード層（`src/facade/`）は再構築した Protobuf スキーマから自動生成されています。各メソッドはリクエストメッセージの形状に一致するプレーンオブジェクトを受け取り、型付きレスポンスを返します。

### イベント駆動 Cascade API

`Cascade` クラスは AI エージェントからのリアルタイムストリーミングを管理します。内部では `CascadeStreamHandler`（gRPC ストリームのライフサイクル管理）と `CascadeEventParser`（状態差分の計算とイベント発火）の2つのモジュールに分離されており、高レベルイベント（`text`, `thinking`, `statusChange`）からステップ単位の詳細イベント（`step:runCommand`, `step:writeToFile`, `step:browserSubagent` など）まで、**130 の型付きイベント** を発火します。

```typescript
const cascade = await client.startCascade();

// 高レベルイベント
cascade.on(Cascade.Events.Text, (ev) => process.stdout.write(ev.delta));
cascade.on(Cascade.Events.Thinking, (ev) => process.stdout.write(ev.delta));
cascade.on(Cascade.Events.StatusChange, (ev) => {
    console.log(`${ev.previousStatus} → ${ev.status}`);
});

// ステップ単位の詳細イベント（約120種類のステップタイプに対応）
cascade.on(Cascade.Events.RunCommand, (ev) => {
    console.log(`コマンド: ${ev.step.value.proposedCommandLine}`);
});
cascade.on(Cascade.Events.WriteToFile, (ev) => {
    console.log(`ファイル: ${ev.step.value.filePath}`);
});

// インタラクション承認（コマンド実行、ファイル編集、ブラウザ操作）
cascade.on(Cascade.Events.Interaction, async (req) => {
    if (req.type === "run_command") {
        await req.approve();
    }
});
```

### 高レベル便利メソッド

シンプルなユースケースでは、イベントの配線を省略できます。

```typescript
// ワンショット: プロンプト送信 → 完了待機 → 結果取得
const result = await cascade.run("このプロジェクトの TypeScript エラーをすべて修正して", {
    model: "Gemini_3_Flash",
    timeoutMs: 120_000,
});

console.log(result.text);        // レスポンス全文
console.log(result.newSteps);    // このターンで追加された CascadeStep[]
console.log(result.finalStatus); // "idle" | "running" | ...
console.log(result.timedOut);    // boolean

// その他の高レベルヘルパー
await cascade.waitForIdle();
await cascade.waitForTurnComplete();
await cascade.cancelAndWait();
```

### 承認制御

ターミナルコマンド、ファイル編集、ブラウザ操作など、エージェントのアクションをプログラム的に承認・拒否できます。

```typescript
// ターミナルコマンド
await cascade.approveCommand(stepIndex, "npm install");
await cascade.denyCommand(stepIndex, "rm -rf /");

// ファイルパーミッション
await cascade.approveFilePermission(stepIndex, "/path/to/file", PermissionScope.ONCE);
await cascade.denyFilePermission(stepIndex, "/path/to/file");

// ブラウザ URL
await cascade.approveOpenBrowserUrl(stepIndex);
await cascade.denyOpenBrowserUrl(stepIndex);

// 汎用インタラクション
await cascade.sendInteraction(stepIndex, "permission", { allow: true, scope: 1 });
```

### モデル選択

利用可能なモデルの照会と、メッセージごとのモデル指定が可能です。

```typescript
// 利用可能なモデル一覧
const models = await client.getAvailableModels();
// => { Gemini_3_Flash: { modelId: 42, isRecommended: true, ... }, ... }

// モデルを明示的に指定して送信
await cascade.sendMessage("このコードを説明して", {
    model: "Gemini_3_Flash",     // 名前で指定
    // model: 42,                // 数値 ID でも可
});

// 画像の添付
await cascade.sendMessage("このスクリーンショットの内容は？", {
    images: [{
        base64Data: "iVBOR...",
        mimeType: "image/png",
        caption: "エラーのスクリーンショット",
    }],
});
```

### スタンドアロンモード（IDE 不要）

Antigravity IDE が起動していなくても、独立した Language Server プロセスを起動できます。SDK が Mock Extension Server を立ち上げ、USS プロトコル経由で OAuth トークンを供給します。

```typescript
const client = await AntigravityClient.launch({
    workspacePath: "/path/to/project",
    verbose: true,
    cdpPort: 9222,  // 任意: Chrome DevTools Protocol ポート
});

// 通常通り使用
const cascade = await client.startCascade();
const result = await cascade.run("このコードベースを分析して");

// クリーンアップ
client.dispose();
client.launcher.stop();
```

### セッション管理

Cascade セッションの再開、一覧取得、管理が可能です。

```typescript
// 既存の Cascade を ID で再開（生存確認あり）
const cascade = await client.resumeCascade("76a484e0-...");

// 検証なしで Cascade に接続
const cascade2 = client.getCascade("76a484e0-...");

// 完全なトラジェクトリ履歴を取得
const history = await cascade.getHistory();

// 実行中のタスクをキャンセル
await cascade.cancel();

// Cascade サマリーのストリーム（全会話のリスト）
for await (const update of client.getSummariesStream()) {
    console.log(update);
}
```

### クイックモデルレスポンス

完全な Cascade セッションを作成せずに、ワンショットで AI レスポンスを取得できます。

```typescript
const response = await client.getModelResponse(
    "フランスの首都は？",
    Model.GEMINI_3_FLASH
);
console.log(response); // "パリ"
```

---

## 接続方法

| メソッド | 説明 | IDE 必要 |
|---------|------|:---:|
| `AntigravityClient.connect()` | 実行中の LS プロセスを自動検出 | はい |
| `AntigravityClient.connect({ port, csrfToken })` | 既知の LS に手動接続 | はい |
| `AntigravityClient.connectWithServer(serverInfo)` | `ServerInfo` オブジェクトで接続 | はい |
| `AntigravityClient.launch(options)` | 独立した LS + Mock Extension Server を起動 | **不要** |
| `AntigravityClient.listServers()` | 実行中の LS プロセスをすべて検出 | はい |

---

## アーキテクチャ

```
あなたのアプリ / CLI / エージェント
        │
        ▼
┌──────────────────────────────────────────────────────┐
│                 antigravity-client                    │
│                                                      │
│  AntigravityClient          ← 接続とライフサイクル管理│
│    .languageServer          ← 188 の RPC メソッド     │
│    .startCascade()          ← イベント駆動セッション  │
│    .resumeCascade()         ← セッション復元          │
│    .getModelResponse()      ← ワンショット推論        │
│                                                      │
│  Cascade                    ← EventEmitter           │
│    ├─ CascadeStreamHandler  ← gRPC ストリーム管理     │
│    └─ CascadeEventParser    ← 状態差分 → 130 イベント │
│                                                      │
│  LanguageServerFacade       ← 自動生成ファサード      │
│    (188 の型安全メソッド)                              │
│                                                      │
│  Launcher + MockExtServer   ← スタンドアロンモード    │
│  AutoDetector               ← LS プロセス検出         │
│  AuthReader                 ← state.vscdb から OAuth  │
└──────────────────────────────────────────────────────┘
        │
        ▼ ConnectRPC (HTTP/2 + TLS)
┌──────────────────────────────────────────────────────┐
│           Language Server (Go バイナリ)               │
│           127.0.0.1:<port>                           │
└──────────────────────────────────────────────────────┘
        │
        ▼ HTTPS
┌──────────────────────────────────────────────────────┐
│               Google AI バックエンド                   │
└──────────────────────────────────────────────────────┘
```

### ソースレイアウト

```
src/
├── index.ts                  # パブリック API エクスポート
├── core/
│   ├── client.ts             # AntigravityClient (接続、起動、モデル解決)
│   └── cascade/
│       ├── index.ts           # Cascade クラス (EventEmitter + API)
│       ├── stream-handler.ts  # gRPC ストリームループ & 状態ハイドレーション
│       └── event-parser.ts    # 状態差分の計算 & イベント発火
├── facade/
│   ├── index.ts               # 型名前空間 (T.LanguageServer.*)
│   ├── services.ts            # LanguageServerFacade (188 自動生成メソッド)
│   └── inputs.ts              # 入力型定義
├── types/
│   ├── index.ts               # CascadeStep、ヘルパー型、enum
│   └── events.ts              # 130 イベント定数 & ペイロード型
├── server/
│   ├── launcher.ts            # スタンドアロン LS プロセス管理
│   ├── mock-extension-server.ts # USS OAuth トークンプロバイダー
│   └── auth-reader.ts         # SQLite 認証情報リーダー
├── utils/
│   └── autodetect.ts          # LS プロセス検出 (ps, lsof)
├── reactive/
│   └── apply.ts               # Protobuf 差分適用
└── gen/                       # 生成済み Protobuf バインディング
    └── exa/
        ├── language_server_pb/  # LS サービス & メッセージ定義
        ├── cortex_pb/           # Cascade 状態、ステップ型、インタラクション
        ├── codeium_common_pb/   # 共通型 (Metadata, Model など)
        └── ...
```

---

## 動作の仕組み

すべての通信は3つのローカルチャネルを通じて行われます:

1. **TLS 上の ConnectRPC** — SDK は `127.0.0.1` 上の LS バイナリに HTTP/2 + セッションごとの CSRF トークンで接続します。IDE が内部的に使用しているのと同じプロトコルです。
2. **読み取り専用 SQLite** — スタンドアロンモードでは、SDK が `state.vscdb` を読み取って OAuth トークンを抽出します。書き込みは行いません。
3. **プロセス検査** — 自動検出は `ps` と `lsof` を使用して、実行中の LS プロセスとそのポートを特定します。

SDK を通じてデータがローカルマシンの外部に送信されることはありません。LS バイナリ自体は Google のバックエンドと通信しますが、SDK は LS とのみ通信します。

---

## プラットフォーム対応

| プラットフォーム | IDE 接続 | スタンドアロンモード |
|-----------------|:---:|:---:|
| **macOS** (arm64/x64) | ✅ | ✅ |
| **Linux** (x64) | ✅ | ✅ |
| **Windows** | ❌ | ❌ |

> Linux サポートは [@Masterisk-F](https://github.com/Masterisk-F) によるコントリビューション ([#7](https://github.com/jkfujinami/antigravity-client/pull/7))。

---

## Protobuf スキーマ

このプロジェクトで使用している再構築済み `.proto` スキーマは、別リポジトリで管理されています:

**[jkfujinami/antigravity-grpc-schemas](https://github.com/jkfujinami/antigravity-grpc-schemas)**

これらのスキーマは Antigravity IDE のフロントエンドバンドルから抽出されたもので、Cascade 状態管理、MCP サーバー制御、リアクティブ更新ストリームなど、LS サービス定義の全体をカバーしています。

---

## サンプルコード

| ファイル | 説明 |
|---------|------|
| [`full_workflow.ts`](examples/full_workflow.ts) | カラー付きターミナル出力の完全なイベントリスナー |
| [`test_cascade_events.ts`](examples/test_cascade_events.ts) | 包括的なイベントアサーションテスト |
| [`test_chat.ts`](examples/test_chat.ts) | シンプルな送受信 |
| [`test_independent_ls.ts`](examples/test_independent_ls.ts) | スタンドアロンモード（IDE 不要） |
| [`test_resume.ts`](examples/test_resume.ts) | 既存の Cascade の再開 |
| [`test_shell_exec.ts`](examples/test_shell_exec.ts) | ターミナルコマンド実行 & 承認 |
| [`test_universal.ts`](examples/test_universal.ts) | クロスプラットフォーム接続テスト |
| [`test_custom_agents.ts`](examples/test_custom_agents.ts) | カスタムエージェント設定 |

任意のサンプルを実行:

```bash
npx tsx examples/full_workflow.ts
```

---

## 免責事項

> [!WARNING]
> このプロジェクトは Google や Antigravity チームとは一切関係ありません。リバースエンジニアリングした Protobuf スキーマを通じて Language Server と通信しています。利用規約を遵守のうえ、自己責任でご使用ください。

---

## コントリビューション

PR 歓迎です。Antigravity のアップデート後にスキーマの不一致が発生した場合は、エラーメッセージと LS のバージョンを添えて Issue を作成してください。

1. リポジトリをフォーク
2. フィーチャーブランチを作成
3. 既存のコードスタイルに従う
4. 提出前に `tsc --noEmit` と `npx tsx examples/test_cascade_events.ts` を実行

---

## ライセンス

[MIT](LICENSE)
