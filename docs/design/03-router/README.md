# 03 — モデルルーター (内部マルチモデル自動振り分け)

**スコープ**（D1）：外からは**単一の賢いAI**に見せる。中ではタスクを分類し、コスト/難易度に応じて
軽量↔フルモデルへ**ターン単位で**振り分ける。旧 `model-router.md` をここに移設。

## 小分けドキュメント計画

- [ ] `tiers.md` — Tier T0〜T3 の定義とモデル/planner対応、実モデル→tier表（実機で埋める）
- [ ] `classifier.md` — 分類ヒューリスティック（ルールベース起点 → 軽量モデル分類へ昇格）
- [ ] `escalation.md` — 「安く試してダメなら1段上げる」再実行と自信判定
- [ ] `single-model-facade.md` — 外部に単一AIとして見せる体験設計（人格の一貫性）
- [ ] `calibration.md` — `modelUsage` 実測でtier見積り/昇格率をキャリブレーション

## なぜ実現できるか（SDK接地）

- `client.getAvailableModels()` → `{ modelId, isPremium, isRecommended, disabled }`（`src/core/client.ts:205`）。
- `sendMessage` は毎回 `requestedModel = new ModelOrAlias({choice:{case:"model", value: modelId}})`（`src/core/cascade/index.ts:413`）。
  **ターンごとに別モデル**を指せる。
- 実消費は `step.metadata.modelUsage`（BigInt）で事後計測（[token-usage](../../api/token-usage.md)）。

→ **追加RPC不要**。ルーターは「分類 → modelId決定 → 既存sendMessage → 実測で学習」の薄い層。

## Tier 設計（例。実モデルは `getAvailableModels()` で解決）

| tier | 用途 | モデル像 | planner |
|---|---|---|---|
| **T0 reflex** | 定型・分類・要約・yes/no・ルーティング判定自身 | 最軽量/非premium | `declarativeMixinConfig`（最小, [§3b](../../api/system-prompt-control.md)） |
| **T1 chat** | 通常会話・軽い調べ物 | 軽量 | conversational（人格あり・ツール少） |
| **T2 work** | コード編集・多段推論・ツール実行 | 標準 | conversational full |
| **T3 deep** | 難問・設計・失敗リトライ・評議会 | premium/フル | full + subagent |

tier は**プロンプトの重さ(planner)とモデルの重さ**を一緒に動かす。軽い用途は軽量モデル＋最小プロンプトで
二重に安く（312トークン床が効く）。ルーター自身の判定(classify)は **T0** で回す。

## 状態の渡し方 — ルーターには「生で」渡す（決定）

ルーターの分類モデルは **T0（最軽量・near-free）** に置く。だから **PC状態・監視信号は惜しまず生で渡す**。
> 「毎プロンプトのトークンをケチる」より「**安いモデルで判定する**」を優先。精度に効くなら state を盛る。

- [01-kernel](../01-kernel/) の `SystemState`（前面アプリ/在席/CPU/メモリ/ディスク/バッテリ/ネット/予定…）を
  そのままトリアージ用モデルに流す。コスト節約は文脈を痩せさせて達成しない（D3の精神）。
- ただし**高性能モデル(T2/T3)への委任は門番付き**：T0で大半を安く棄却してから上位へ（[01-kernel監視ループ](../01-kernel/)）。
  「生を渡して安く判定 → 必要な分だけ高いモデル」の二段で、盛っても総額は安い。
- 機微信号（クリップボード/位置）はここでも例外：デフォルト渡さない（[08-governance](../08-governance/)）。

## 分類の初期ヒューリスティック（ルールベースで開始）

- **長さ/構造**：短い定型→下位。コードブロック/複数質問/「設計して」→上位。
- **キーワード**：`実装/デバッグ/設計/なぜ/比較`→上げ、`要約/翻訳/はい・いいえ/分類`→下げ。
- **外部作用**：shell/書き込みを伴いそう→最低 T2（失敗コスト高、安モデルで事故らせない）。
- **文脈量**：長い履歴/大ファイル→上げ。 **残予算**：細ければ全体を1tier下げ（[08-governance](../08-governance/) 連動）。
- **状況(SystemState)**：在席×前面IDE→コード文脈でT2、深夜/ロック/長アイドル→自発発火の閾値↑（喋りにくく）、バッテリ低/ネット無→T3委任を渋り軽量寄せ。

## エスカレーション

```
result = run(tier=T1)
if result.low_confidence or result.failed_selfcheck:
    result = run(tier=T2)   # 1段だけ上げて再実行
```
自信は (a) T0で自己申告 / (b) メタ認知の自己採点（[07-metacognition](../07-metacognition/)）。
「安く1回＋たまに2回」が「毎回フル1回」より安いかは昇格率をログして検証。

## 外は単一AIに見せる

- tier をユーザーに見せない。人格は [02-registry](../02-registry/) の persona で固定（tierが変わっても identity 同一）。
- デバッグ用に「今どのtier/モデル/何トークン」を内部ログに必ず残す（メタ認知・説明可能性の素材）。
- 破綻点：tier間で文体ブレ／軽量モデルが人格を保てない → 軽量tierにも identity を必ず載せる。

## インターフェース案

```ts
interface RouteDecision { modelId: number; tier: "T0"|"T1"|"T2"|"T3";
  plannerType: "declarativeMixin"|"conversational"|"full"; reason: string; estInputTokens?: number; }
interface ModelRouter {
  route(input: { agent: string; instruction: string; ctx: RunContext }): Promise<RouteDecision>;
  observe(decision: RouteDecision, usage: ModelUsageStats): void;  // 事後学習
}
```

## 未決事項
- 実モデル→tierマッピング（実機で `getAvailableModels()` 列挙して埋める）。
- 自信判定を「自己申告」中心か「self-critique」中心か。
- 分類器をルールベース→軽量モデルへ昇格する条件。

## 関連
- [token-usage](../../api/token-usage.md) 実測 / [system-prompt-control](../../api/system-prompt-control.md) プロンプト重量 / [01-kernel](../01-kernel/) 監視ループでtier流用
