# Antigravity Client & SDK

A TypeScript client library and CLI tool for interacting with the **Antigravity Language Server (LS)** using the Connect (gRPC) protocol.

このライブラリは、AI エージェントと直接やり取りするためのフル機能を備えた SDK です。本家 IDE 拡張機能と同じプロトコルを使用して、独自の自動化や UI を構築できます。

## ⚠️ 免責事項 (Disclaimer)

- **非公式ライブラリ**: 本プロジェクトは個人による非公式な実装であり、Google DeepMind または Google 社とは一切関係ありません。
- **無保証**: 本ソフトウェアの使用によって生じた直接的・間接的な損害について、開発者は一切の責任を負いません。
- **利用規約**: 本ライブラリを使用する際は、Antigravity (Google AI) の利用規約を遵守してください。
- **対応プラットフォーム**: 現在 **macOS のみ** 対応しています。LS プロセスの自動検出（`lsof`）、バイナリパス、`state.vscdb` の読み取りパスがすべて macOS 固有です。Linux / Windows への対応は将来課題です。

> **認証について**: API Key は `state.vscdb`（Antigravity IDE のローカルストレージ）から自動で読み取られます。環境変数 `ANTIGRAVITY_API_KEY` で明示指定することも可能です。

---

## クイックスタート

### 方法 1: 既存の Antigravity IDE に接続（推奨）

```typescript
import { AntigravityClient } from "antigravity-client";

const client = await AntigravityClient.connect();
const status = await client.getUserStatus();
console.log(status.userStatus?.name); // "カワハギうなぎ"
```

### 方法 2: 独立 LS を起動して接続（IDE 不要）

```typescript
import { AntigravityClient } from "antigravity-client";

const client = await AntigravityClient.launch({
    workspacePath: "/path/to/project",
    verbose: true,
});

const status = await client.getUserStatus();
console.log(status.userStatus?.name);

// 使い終わったら停止
await client.launcher.stop();
```

---

## アーキテクチャ

```
┌──────────────────┐       ┌───────────────────────┐       ┌─────────────┐
│  Your App / CLI  │──────>│  Language Server (LS) │<──────│  Google API │
│  (SDK Client)    │ gRPC  │  (Go binary)          │ HTTPS │             │
└──────────────────┘       └───────────────────────┘       └─────────────┘
                                   ▲
                                   │ Connect RPC
                           ┌────────────────────────┐
                           │ Mock Extension Server  │
                           │ (OAuth token provider) │
                           └────────────────────────┘
```

- **方法 1**: SDK が既存の LS プロセス（Antigravity IDE が起動したもの）を自動検出して接続
- **方法 2**: SDK が Mock Extension Server + LS を自分で起動し、`state.vscdb` から認証トークンを読み取って LS に供給

---

## 1. クライアント基本 (`AntigravityClient`)

### 接続メソッド

| メソッド | 説明 |
| :--- | :--- |
| `connect(options?)` | 既存の LS を自動検出して接続（推奨） |
| `launch(options?)` | 独立 LS を起動して接続（IDE 不要） |
| `listServers()` | 起動中の全 LS サーバー情報を取得 |
| `connectWithServer(server)` | 特定のサーバーに直接接続 |

### システム情報取得

| メソッド | 説明 |
| :--- | :--- |
| `getUserStatus()` | ログイン状況・プラン・ユーザー情報 |
| `getModelStatuses()` | AI モデルの稼働状況 |
| `getAvailableModels()` | 利用可能なモデルを構造化 JSON で取得 |
| `getWorkingDirectories()` | LS が認識しているプロジェクトパス |
| `getSummariesStream()` | 会話サマリーの reactive stream |

### セッション管理

| メソッド | 説明 |
| :--- | :--- |
| `startCascade()` | 新しいチャットセッションを開始 |
| `getCascade(cascadeId)` | 既存セッションを再開 |

---

## 2. 対話管理 (`Cascade`)

### メッセージと制御

- `sendMessage(text, options?)` — AI にメッセージを送信。モデル変更も可能
- `getHistory()` — 過去のやり取りを全取得
- `cancel()` — 進行中の AI 処理を中断

### 承認インタラクション

- `approveCommand(stepIndex, proposed, submitted?)` — コマンド実行を承認
- `approveFilePermission(stepIndex, pathUri, scope)` — ファイルアクセスを承認
- `approveOpenBrowserUrl(stepIndex)` — URL を開くことを承認
- `sendInteraction(stepIndex, case, value)` — 汎用インタラクション

---

## 3. イベントシステム

| イベント名 | 説明 |
| :--- | :--- |
| `text` | AI からの回答テキスト差分 |
| `thinking` | AI の思考プロセス |
| `status` | ステップの状態変化 |
| `interaction` | 承認が必要なアクション |
| `command_output` | コマンド実行の出力 |
| `update` | CascadeState の更新 |
| `done` | ターン完了 |
| `error` | エラー |

---

## 4. 独立 LS 管理 (`Launcher`)

IDE を起動せずに LS を単独で管理するためのモジュール群。

### `Launcher`

```typescript
import { Launcher } from "antigravity-client";

const ls = await Launcher.start({
    workspacePath: "/path/to/project",
    verbose: true,
});

console.log(ls.httpsPort);  // Connect RPC ポート
console.log(ls.csrfToken);  // CSRF トークン
console.log(ls.pid);        // LS プロセス ID

await ls.stop();
```

### `MockExtensionServer`

LS が必要とする Extension Server の最小実装。OAuth トークンを USS (Unified State Sync) プロトコルで供給。

### `readAuthData()`

`state.vscdb` から認証情報を読み取るヘルパー。

### 必要条件

- Antigravity.app がインストールされていること
- 一度は Antigravity IDE でログイン済みであること（`state.vscdb` にトークンが保存される）

---

## 5. フォルダ構造

```
src/
├── index.ts              # 全エクスポート
├── client.ts             # AntigravityClient
├── cascade.ts            # Cascade (チャットセッション管理)
├── autodetect.ts         # LS プロセス自動検出
├── repl.ts               # CLI REPL
├── reactive/
│   └── apply.ts          # Reactive Diff 適用
├── server/               # 独立 LS 管理
│   ├── index.ts          # エクスポート
│   ├── launcher.ts       # LS 起動・管理
│   ├── mock-extension-server.ts  # Mock Extension Server
│   ├── auth-reader.ts    # state.vscdb からの認証読み取り
│   └── metadata.ts       # LS stdin 初期化データ
└── gen/                  # Proto 生成コード
```

## License
MIT License
