# 自律エージェント基盤 — 設計（機能別）

> コードネーム未定（JARVIS / ドラえもん的な常駐AI相棒）。以下 **Runtime**。
> `antigravity-client` SDK（cascade / schedule / subagent / prompt制御 / token可視化）の上に、
> **名前で呼び出せて、自発的に動き、自分で賢くなる**常駐エージェントを作る。

## このディレクトリの使い方

機能ごとにフォルダを分けた。**1機能ずつ研究して埋めていく**。各フォルダの `README.md` が：
- **スコープ**（この機能は何を担うか）
- **小分けドキュメント計画**（研究したらこの粒度で個別ファイルに割る、というチェックリスト）
- **現時点の知見**（分かっていること・確定方針）
- **SDKフック / 未決事項**

を持つ。研究が進んだ項目だけ、その都度チェックリストから個別 `.md` に切り出す（最初から空ファイルを量産しない）。

## 設計思想（3行）

1. **外から見たら1つの賢いAI**。中では軽量↔フルモデルをコストを見て自動で振り分ける（[03-router](03-router/)）。
2. **人間が毎回話しかけなくても動く**。トリガーを引く主体をカーネルに移す＝自発介入（[01-kernel](01-kernel/)）。
3. **道具も専門家も自分で増やす**。ただし憲法（予算・承認・killswitch）の内側で（[08-governance](08-governance/)）。

## 確定した設計方針

- **D1. 内部マルチモデル自動ルーティング** — 外向きは単一モデル。内部でタスク分類しコスト/難易度でtier振り分け。
  SDKの `sendMessage` は毎ターン `ModelOrAlias` で別モデルを指定でき、**追加RPC不要**。→ [03-router](03-router/)
- **D2. ツール = Shell 実行（MCP不使用）** — 能力＝シェルコマンド。`safeShell` を唯一の外部作用ゲートにする。→ [06-tools](06-tools/)
- **D3. 段階的コスト制御** — 常駐は非LLMで足切り→軽量モデルが門番→必要時のみ上位に委任。
  節約は"文脈を痩せさせる"のではなく**"安いモデルを門番に置く"**で達成。ルーターには状態を**生で**渡す。→ [01-kernel](01-kernel/) / [03-router](03-router/)
- **D4. 認識は絶対でない** — 推定は確信度付き。確信なきものは確定事実として扱わず、確認を取る。→ [04-perception](04-perception/)
- **D5. 思考と発話の分離** — 常駐の調査は**サイレントがデフォルト**。イベントで分離できる（実験確認済み）：
  **思考=`Thinking`**（内部推論・出さない）／ **発話=`Text`**（`plannerResponse`本文）。
  「必要な時だけ喋る」は**カーネルがTextをゲート**して実現。形式は4方式の実測比較の末 **```sys_json``` フェンス内のJSON**に確定
  （`surface`で発話ゲート、`priority`/`needs_confirm`/`escalate`/`message`も1コールで取得。24/24でparse・スキーマ100%、フェンス外の思考漏れは無視できる）。
  ⚠ `send_message` ツールは**ユーザー窓口ではなくエージェント間通信専用**（実験で判明）。→ [01-kernel](01-kernel/)
- **D6. 閾値はLLM編集可能なコンフィグ** — 発火閾値はエージェントが自己チューニング（誤検知/無視履歴から）。
  暴走防止に**上下限clamp＋版管理＋ロールバック**必須。→ [01-kernel](01-kernel/) / [07-metacognition](07-metacognition/) / [08-governance](08-governance/)
- **D7. イベント駆動（`run()`不使用）** — `Cascade` は `EventEmitter`。常駐は長命cascadeを1本持ち `cascade.listen()` で
  reactiveストリームを受け（`startCascade()`が内部で自動起動）、`sendMessage()` でターン投入、`on(...)` で拾う。
  `run()`（完了待ちラッパ）は使わない。イベント種別が **思考(`Thinking`)/発話(`Text`)** を分離してくれる（D5と直結、実験確認済み）。→ [01-kernel](01-kernel/)

## レイヤ & フォルダ対応

```
┌──────────────────────────────────────────────┐
│ ① カーネル (常駐/イベントバス/監視ループ/文脈)  │ 01-kernel
├──────────────────────────────────────────────┤
│ ② 登録簿 (名前→persona/tools/budget/memory)    │ 02-registry
├──────────────────────────────────────────────┤
│ ③ モデルルーター (tier振り分け, 単一AIに見せる) │ 03-router
├──────────────────────────────────────────────┤
│ ④ 知覚 (集音/分離/センサ/状況)  ⑤ 記憶 (圧縮/KG)│ 04-perception / 05-memory
├──────────────────────────────────────────────┤
│ ⑥ ツール (safeShell/自己拡張/web/画面/PC操作)   │ 06-tools
├──────────────────────────────────────────────┤
│ ⑦ メタ認知 (自己採点/再帰プロンプト改善)        │ 07-metacognition
├──────────────────────────────────────────────┤
│ ⑧ 憲法 (予算/承認/killswitch/認証情報)          │ 08-governance
└──────────────────────────────────────────────┘
   横断: ⑨ 音声(09-voice)  ⑩ 複数端末同期(10-sync)
```

「エージェント名, 指示」で起動する流れ：
```
input(name, instruction)
  → registry.get(name)           # persona/許可ツール/予算/記憶 (02)
  → router.classify(instruction) # tier決定 (03)
  → cascade(長命・listen()でイベント購読, persona注入, modelId指定, 記憶を文脈)  (04/05, D7)
  → sendMessage()で投入 → イベントで受け(思考=Thinking黙 / 発話=Textをカーネルがゲート) / shellツール(承認ゲート)  (06/08, D5)
  → メタ認知: trajectory自己採点 → 記憶へ  (07/05)
```
自発介入は「④を叩くのが人間ではなくカーネル」というだけ。入口は同じ。

## 機能一覧と状態

| # | 機能 | 状態 | 一言 |
|---|---|---|---|
| [01-kernel](01-kernel/) | カーネル | 🌱 種 | 常駐・イベントバス・監視ループ・文脈管理 |
| [02-registry](02-registry/) | 登録簿 | 🌱 種 | 名前+指示の実体、persona注入 |
| [03-router](03-router/) | モデルルーター | 🌿 知見あり | tier振り分け、外は単一AI（旧 model-router を移設） |
| [04-perception](04-perception/) | 知覚 | 🌿 知見あり | 集音/話者分離/センサ/状況（旧 perception を移設） |
| [05-memory](05-memory/) | 記憶 | 🌿 知見あり | ローリング要約/長期/ナレッジグラフ |
| [06-tools](06-tools/) | ツール(Shell) | 🌿 知見あり | safeShell/自己拡張（旧 tools-shell を移設） |
| [07-metacognition](07-metacognition/) | メタ認知 | 🌱 種 | 自己採点、再帰的プロンプト改善 |
| [08-governance](08-governance/) | 憲法 | 🌱 種 | 予算/承認/killswitch/認証情報 |
| [09-voice](09-voice/) | 音声 | 🌿 知見あり | STT(LS)+外部TTS+ターンテイキング |
| [10-sync](10-sync/) | 複数端末同期 | 🌱 種 | 複数端末・プラットフォーム横断 |

🌱=スコープと計画のみ / 🌿=既存知見を移設済み / 🌳=実装着手

## 既存SDKドキュメントへの接続

| 使うもの | 参照 |
|---|---|
| 人格注入 / プロンプト最小化 | [system-prompt-control](../api/system-prompt-control.md) |
| 自発発火 (schedule/cron) | [send-user-cascade-message](../api/send-user-cascade-message.md) |
| メタ認知の実測 (modelUsage) | [token-usage](../api/token-usage.md) |
| モデル列挙/選択 | `src/core/client.ts:205` `getAvailableModels` / `src/core/cascade/index.ts:413` |
| 音声入力 | [voice-realtime-design](../api/voice-realtime-design.md) |

## 規約

- ファイルは**小さく1トピック**。大きくなったらフォルダのチェックリストに沿って割る。
- 各docの末尾に **未決事項** と **関連** を置く。
- 推測で書いた箇所は「未検証」と明記（特にLSの実能力）。
