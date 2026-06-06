---
title: Google Antigravity の Language Server をリバースエンジニアリングして、非公式 TypeScript クライアントを作った
tags:
  - TypeScript
  - gRPC
  - Protobuf
  - AI
  - リバースエンジニアリング
private: false
updated_at: ''
id: null
organization_url_name: null
slide: false
ignorePublish: false
---

## これは何

数ヶ月前から、Google Antigravity の **Language Server（以下 LS）が内部で使っている Protobuf スキーマ**を解析・復元していました。今回、その成果として、LS と直接 ConnectRPC で会話する **完全非公式の TypeScript クライアント**を公開します。

CLI のラップでもなければ UI スクレイピングでもありません。IDE 本体がやっているのと**まったく同じプロトコル**で、`LanguageServerService` を直接叩きます。

公式 Python SDK が隠蔽している抽象化レイヤーを丸ごとバイパスして、**Cascade エンジンの内部データ構造に生でアクセスできる**のがこのクライアントの肝です。

- **クライアント本体 / SDK:** https://github.com/jkfujinami/antigravity-client
- **復元したスキーマ:** https://github.com/jkfujinami/antigravity-grpc-schemas

:::note warn
**免責**：これは Google 非公認の非公式プロジェクトです。リバースエンジニアリングで復元したプロトコル定義に基づいており、Antigravity の利用規約や将来のバージョンとの互換性は一切保証しません。あくまで技術的な検証・学習目的での共有です。利用は自己責任でお願いします。
:::

## まず動かしてみる

```ts
import { AntigravityClient, Cascade } from "antigravity-client";
import type { TextDeltaEvent, ThinkingDeltaEvent } from "antigravity-client";

// IDE のインストールを自動検出して LS に接続（IDE 本体は不要）
const client = await AntigravityClient.connect({ autoDetect: true });

// Cascade セッションを開始
const cascade = await client.startCascade();
console.log(`Cascade ID: ${cascade.cascadeId}`);

// エージェントの出力をリアルタイムで購読
cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
  process.stdout.write(ev.delta);
});
cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => {
  process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`); // 思考過程をグレーで表示
});

// 1ターン実行
await cascade.run("README をリファクタしてテストを通して", { timeoutMs: 60000 });

client.dispose();
```

これだけで、IDE の中で動いているのと同じ Cascade エージェントを、コードから直接駆動できます。

## きっかけ：Language Server は「補完エンジン」ではなかった

解析を進めるほどに分かってきたのは、この LS が単なる補完エンジンの域をはるかに超えているということでした。中核に **Cascade エンジン**が鎮座していて、全体が**驚くほど高機能なエージェント基盤**として設計されています。プランニング・実行・マルチエージェントのオーケストレーションが、すべて 1 本のプロトコルの中に同居していました。

さらに掘ると、設定可能なパラメータの多さに驚きました。エンジンの挙動を細かくチューニングするための膨大なノブが用意されていて、その**ほとんどが公式ドキュメントにも公開 SDK にも載っていない**。本来は IDE の開発者だけが触る、隠れたレイヤーです。

それなら表に出そう、と思って作ったのがこのクライアントです。

## proto をどうやって復元したか

Protobuf の定義（シリアライズ済みの descriptor）は、**Antigravity IDE のクライアント側 JS バンドル（Electron アプリ）**に埋め込まれていました。LS バイナリを直接いじったわけではありません。このバンドルから descriptor を抽出し、`.proto` スキーマとして復元しました。

復元したものの一部：

- `language_server.proto` … LS 本体のサービス定義
- `cortex.proto` … Cascade エンジンの中核データ構造
- `exa/google/internal/...` … Google 内部のクラウド API 定義群

復元した `.proto` から `buf` + `connect-es` で型安全な TypeScript を生成し、その上に薄い facade を被せています。

## 公式 Python SDK（`google-antigravity-sdk`）との違い

公式の Python SDK を見たことがある人なら気づくと思いますが、あれは**チャットボット的なアプリを作るための高レベルフレームワーク**です。内部では `localharness` という強く抽象化されたプロトコルを使っていて、できることが「テキストを送る（`InputEvent`）／ツール呼び出しを受け取る（`OutputEvent`）」に絞り込まれています。

このクライアントはそのレイヤーを丸ごとスキップします。ネイティブの `LanguageServerService` プロトコルを直接話すので、**Cascade エンジンの内部データ構造に生でアクセスできる**。

**約 188 個の RPC メソッド**が型安全な facade（`client.lsClient`）でラップされていて、IDE の開発者が使っているのと同じメッセージ型をそのまま扱えます。

```ts
// 任意の RPC を直接呼べる
const wd = await client.lsClient.getWorkingDirectories({});
console.log(wd.directories?.map(d => d.absoluteUri));
```

## 公式 SDK が隠している「設定レイヤー」

エンジンと直接話すということは、エンジンを**駆動する**だけでなく、エンジンの**挙動そのものをプログラムできる**ということです。`CascadePlannerConfig` や `CascadeExecutorConfig` といった内部設定に手が届きます。これらはどの公式ドキュメントにも存在しません。

例えば proto 上にはこんなフラグがあります（一部）：

- `disable_loop_detection` … ループ検出を切って、長時間走り続ける完全自律エージェントを組む
- `no_tool_explanation` … ツール呼び出しの説明生成を省いて、CI/CD パイプライン用に推論オーバーヘッドを削る
- `workspace_paths` … エージェントがアクセスできる範囲を動的に限定（サンドボックス化）
- `research_only` … エンジンレベルでファイル操作・ターミナル操作を無効化

「プロンプトを投げて応答を受け取る」というモデルの外側に、完全に出られます。

## Battle Mode：マルチエージェント並列実行

個人的に一番面白かったのがこれです。同じ問題に対して**複数のエージェントを並列に fork** し、それぞれの解を `MergeStrategy` でマージできます。

```ts
// 同一タスクに対して複数エージェントを並列起動 → 結果をマージ
await client.lsClient.startBattleMode({ /* ... */ });
// ...
await client.lsClient.endBattleMode({ /* ... */ });
```

IDE の中ではボタン一発の機能ですが、これをコードから任意のワークフローに組み込めます。

## さらに深く：内部開発者向け API

ここからは完全に内部向け、公開ドキュメントにはまず載っていない領域です。

```ts
// 現在エージェントに適用されている A/B テスト・実験フラグを全部ダンプ
const res = await client.lsClient.getMendelFlags({});
const experiments = res.experimentConfig?.experiments ?? [];
console.log(`Found ${experiments.length} Mendel Flags`); // → 250
```

実際に叩くと **250 個の Mendel フラグ**（Google 社内の A/B テスト・実験フラグ）が返ってきます。`setBaseExperiments()` で上書きもできます。

他にも：

- `dumpFlightRecorder()` … メモリと goroutine のフルプロファイリングダンプを要求
- `simulateSegFault()` … テスト目的で LS プロセスを意図的にクラッシュさせる診断フック

どれだけ深いところまでアクセスできるか、雰囲気は伝わるかと思います。

## リアルタイムイベントの傍受（130+ 種類）

ネイティブプロトコルを話すので、**動いている Antigravity IDE のインスタンスにアタッチして、130 種類以上のイベントをリアルタイムで傍受**することもできます。

`Cascade` クラスが内部でストリームのライフサイクル管理（`CascadeStreamHandler`）と状態差分の計算・イベント発火（`CascadeEventParser`）に分かれていて、高レベル（`text` / `thinking` / `statusChange`）からステップ単位（`step:runCommand` / `step:writeToFile` / `step:browserSubagent` …）まで型付きで発火します。

```ts
cascade.on(Cascade.Events.StatusChange, (ev) => {
  console.log(`[STATUS] ${ev.status}`);
});

cascade.on(Cascade.Events.StepNew, (ev) => {
  console.log(`STEP ${ev.step.index}: ${ev.step.type}`);
});
```

## Standalone モード（IDE なしで動かす）

IDE 本体を立ち上げずに、**自前で LS プロセスを起動して駆動する**ことができます。OAuth トークンの取り回しも、独自の USS（Unified State Sync）モックサーバーでネイティブに処理しています。

```ts
// IDE を一切起動せずに、自前で LS プロセスを spawn して接続
const client = await AntigravityClient.connect({ autoDetect: true });
```

## インストール

```bash
git clone https://github.com/jkfujinami/antigravity-client
cd antigravity-client
npm install
npm run build
```

Antigravity のインストール先は自動検出します。**Antigravity 2.0 に対応**、**macOS / Linux でネイティブに動作**します。

## アーキテクチャ概観

```
AntigravityClient
├── client.lsClient           ← 188 個の型安全な RPC メソッド (LanguageServerFacade)
│     └─ LanguageServerService over ConnectRPC
│
└── client.startCascade()     ← Cascade セッション
      ├─ CascadeStreamHandler    （gRPC ストリームのライフサイクル）
      └─ CascadeEventParser      （状態差分 → 130+ の型付きイベント）
```

## おわりに

このクライアントが面白いのは、「プロンプトを投げて応答を受け取る」という枠の外に出て、**IDE の開発者自身が触っているのと同じ深さで Cascade エンジンを制御できる**点だと思っています。公式 SDK の抽象化に縛られず、自分だけの自律エージェントを組むための土台として使えます。

- **クライアント本体 / SDK:** https://github.com/jkfujinami/antigravity-client
- **復元したスキーマ:** https://github.com/jkfujinami/antigravity-grpc-schemas

質問やフィードバック、こんなの作ったよ、みたいな報告も歓迎です。

> 解析手法について：proto の descriptor はクライアント側の JS バンドルに埋め込まれていたので、そこから抽出して `.proto` に復元しました。LS バイナリを直接解析したわけではありません。
