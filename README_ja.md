# Antigravity Client & SDK

A TypeScript client library and CLI tool for interacting with the **Antigravity Language Server (LS)** using the Connect (gRPC) protocol.

本ライブラリは、Antigravity IDE のフロントエンドコードとバックエンド通信のリバースエンジニアリングを通じて、消失した Protobuf スキーマを復元し、その核心的機能をプログラムから直接操作可能にした非公式 API です。

---

## 🤖 強力な AI エージェント作成基盤としての SDK

Antigravity LS は、単なるコーディング補助ツールではなく、**高度な自律型 AI エージェントを構築するための堅牢な基盤（SDK）**として利用可能です。

- **マネージドなセッション & コンテキスト管理**: セッション管理やコンテキストウィンドウの最適化といった複雑な処理は、すべて LS サーバー側が担当します。開発者は低レイヤーな状態保持の実装に悩まされることなく、エージェントのロジックや振る舞いといった「高レイヤー」な開発に集中できます。
- **高度なプロンプト・チューニング**: メッセージ単位でカスタムプロンプトやメタデータを注入することが可能です。これにより、特定の状況下におけるエージェントの挙動を極めて精密に調整できます。
- **検索機能とツールの統合**: 内蔵の Web 検索、ファイルインデックス、ターミナル実行機能をシームレスに統合。SDK を通じてこれらのツールを戦略的に組み合わせ、単一のメッセージ単位で AI に高度な指示を出すことができます。

コンテキスト管理という重い荷物を LS に預けることで、あなたはエージェントの「脳」の設計にそのリソースを注ぎ込むことが可能になります。

---

## ⚠️ 免責事項 (Disclaimer)

- **非公式ライブラリ**: 本プロジェクトは個人による非公式な実装であり、Google DeepMind または Google 社とは一切関係ありません。
- **無保証**: 本ソフトウェアの使用によって生じた直接的・間接的な損害について、開発者は一切の責任を負いません。
- **利用規約**: 本ライブラリを使用する際は、Antigravity (Google AI) の利用規約を遵守してください。
- **対応プラットフォーム**: 現在 **macOS のみ** 対応しています。

---

## クイックスタート

### インストール

```bash
npm install github:jkfujinami/antigravity-client
```

### 基本的な使い方

```typescript
import { AntigravityClient } from "antigravity-client";

// 既存の IDE プロセスに接続
const client = await AntigravityClient.connect();
const status = await client.getUserStatus();
console.log(`Connected as: ${status.userStatus?.name}`);
```

---

## 🔌 詳細な接続方法

### 1. 既存の Antigravity IDE に接続（推奨）
公式 IDE が起動した Language Server プロセスを自動検出し、その通信チャネルを乗っ取ります。

```typescript
const client = await AntigravityClient.connect();
```

### 2. 独立 LS を起動して接続（IDE 不要）
Mock Extension Server を立ち上げ、LS バイナリを単独で制御します。

```typescript
const client = await AntigravityClient.launch({
    workspacePath: "/path/to/project",
    verbose: true,
});
```

---

## 🏗️ アーキテクチャ

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

- **方法 1**: SDK が既存の LS プロセスを自動検出し、直接接続します。
- **方法 2**: SDK が独自の Mock Extension Server を起動し、USS (Unified State Sync) プロトコルを介して OAuth トークンを LS に供給します。

---

## 📋 License
MIT License
