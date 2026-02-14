# Antigravity Client & SDK Exhaustive Guide

A TypeScript client library and CLI tool for interacting with the **Antigravity Language Server (LS)** using the Connect (gRPC) protocol.

このライブラリは、AI エージェントと直接やり取りするためのフル機能を備えた SDK です。本家 IDE 拡張機能と同じプロトコルを使用して、独自の自動化や UI を構築できます。

## ⚠️ 免責事項 (Disclaimer)

- **非公式ライブラリ**: 本プロジェクトは個人による非公式な実装であり、Google DeepMind または Google 社とは一切関係ありません。
- **無保証**: 本ソフトウェアの使用によって生じた直接的・間接的な損害（データの損失、システムの停止、セキュリティリスク等）について、開発者は一切の責任を負いません。
- **利用規約**: 本ライブラリを使用する際は、Antigravity (Google AI) の利用規約を遵守してください。

---

## 1. クライアント基本 (`AntigravityClient`)

`AntigravityClient` は、サーバーの自動検出、接続、および全体的な状態取得を管理します。

### 接続メソッド
- **`static async listServers(): Promise<ServerInfo[]>`**
  起動中の全ての Antigravity LS サーバー情報を取得します。
- **`static async connectWithServer(server: ServerInfo, apiKey?: string): Promise<AntigravityClient>`**
  取得したサーバー情報を直接指定して接続します。
- **`static async connect(options?: ClientOptions): Promise<AntigravityClient>`**
  （推奨）自動検出機能を使用してサーバーに接続します。
  - `options.autoDetect`: `true` (デフォルト) の場合、ポートとトークンを自動検出。
  - `options.workspacePath`: 特定のワークスペースに紐づくサーバーを優先検出。
  - `options.port` / `options.csrfToken`: 手動指定。

### システム情報取得
- **`getUserStatus(): Promise<any>`**
  現在のログイン状況、プラン、ユーザー情報を取得。
- **`getModelStatuses(): Promise<any>`**
  現在選択可能な AI モデルの一覧と稼働状況を取得。
- **`getWorkingDirectories(): Promise<any>`**
  LS が認識している開かれているプロジェクトのパス一覧を取得。
- **`getAvailableModels(): Promise<Record<string, any>>`**
  利用可能なモデルを構造化された JSON 形式で取得します（キーはモデルラベル例: `Gemini_3_Flash`）。
- **`async *getSummariesStream()`**
  会話のサマリー履歴更新を reactive stream として取得します。

### セッション開始
- **`startCascade(): Promise<Cascade>`**
  新しいチャットセッションを開始します。
- **`getCascade(cascadeId: string): Promise<Cascade>`**
  既存のセッションを再開します。

---

## 2. 対話管理 (`Cascade`)

AI とのメッセージのやり取り、ツールの実行承認、履歴の取得を行います。

### メッセージと制御
- **`sendMessage(text: string, options?: { model?: Model }): Promise<any>`**
  AI にメッセージを送信します。`Model` enum を使用してモデルを動的に変更可能です。
- **`getHistory(): Promise<any>`**
  過去のやり取り（軌跡 / Trajectory）をすべて取得し、ローカルの `state` を同期します。
- **`cancel(): Promise<void>`**
  現在進行中の AI の思考やツール実行リクエストを中断します。

### 承認インタラクション (Interaction Approvals)
AI が機密性の高いアクションを行う際に使用します。

- **`approveCommand(stepIndex, proposed, submitted?)`**
  コマンド実行を承認します。
  - `proposed`: AI が提案したコマンド文字列。
  - `submitted`: 実際に実行するコマンド（編集して実行する場合に使用）。
- **`approveFilePermission(stepIndex, pathUri, scope)`**
  ファイルアクセスを承認します。
  - `scope`: `PermissionScope.ONCE` (今回のみ) または `PermissionScope.CONVERSATION` (セッション中)。
- **`approveOpenBrowserUrl(stepIndex)`**
  URL をブラウザで開くことを承認します。
- **`sendInteraction(stepIndex, case, value)`**
  汎用インタラクション送信メソッド。カスタムツールなどの拡張に使用。

---

## 3. イベントシステム (`Cascade Events`)

`Cascade` インスタンスから発行されるイベントを購読することで、AI の出力をリアルタイムに処理できます。

| イベント名 | プロパティ | 説明 |
| :--- | :--- | :--- |
| **`text`** | `delta`, `text`, `stepIndex` | AI からの回答テキストの差分と累積。 |
| **`thinking`** | `delta`, `text`, `stepIndex` | AI の思考プロセス（内部モノローグ）の差分。 |
| **`status`** | `status` | ステップの状態（WAITING, RUNNING, DONE）。 |
| **`interaction`** | `interaction`, `stepIndex`, `needsApproval`, `commandLine` | 承認が必要なアクションが発生したとき。 |
| **`command_output`** | `delta`, `text`, `outputType`, `stepIndex` | 実行中コマンドの標準出力・標準エラー。 |
| **`update`** | `state` | `CascadeState` が更新されるたびに発行。 |
| **`done`** | - | 1つのターン（AI の一連の回答とツール使用）が完了したとき。 |
| **`error`** | `error` | 通信切断やプロトコル違反などのエラー。 |

---

## 4. プロトコル互換性の維持 (重要)

本 SDK は公式クライアントの挙動を模倣するため、以下の「復唱（Echo）」ロジックを内蔵しています。
- **コマンド承認での復唱**: `submittedCommandLine` を明示的にセットすることで `input not registered` エラーを防ぎます。
- **軌跡の継続**: 承認パケットに `trajectoryId` を含めることで、AI が文脈を見失わないようにしています。

## 5. 応用: モデルの動的選択

`getAvailableModels()` ヘルパーを使用すると、現在のアカウントで利用可能なモデルをプログラムから簡単に選択できます。

```typescript
// 利用可能なモデルを取得
const models = await client.getAvailableModels();

// Gemini 3 Flash の ID を取得してメッセージを送信
if (models["Gemini_3_Flash"]) {
    const flashId = models["Gemini_3_Flash"].modelId;
    await cascade.sendMessage("最新のニュースは？", { model: flashId });
}
```

## 6. フォルダ構造

- `src/client.ts`: エントリーポイント
- `src/cascade.ts`: 状態・イベント管理
- `src/autodetect.ts`: ポート/トークン自動検出ロジック
- `src/gen/`: Proto 定義（Connect/gRPC 自動生成コード）
- `src/reactive/apply.ts`: 高速な差分更新（Reactive Diff）適用アルゴリズム

## License
MIT License
