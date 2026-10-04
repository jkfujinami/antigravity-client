# 02 — 登録簿 (registry)

**スコープ**：入力「**エージェント名, 指示**」の実体。名前を引くと、その人格・使える道具・予算・
記憶がロードされ、cascade を起動できる。personaが tier をまたいでも一貫するよう固定する役目も持つ。

## 小分けドキュメント計画

- [ ] `schema.md` — 登録レコードの型：`name → { persona, tools(=ShellPolicy.allow), budget, memory参照 }`
- [ ] `persona-injection.md` — `replace_prompt_sections` で identity/方針を注入。tierが変わっても identity は同一を注入
- [ ] `dispatch.md` — 「名前+指示」→ ロード → router → cascade起動 の入口処理
- [ ] `lifecycle.md` — エージェントの生成/更新/破棄、自己増殖で増えたsubagentの登録

## 現時点の知見

- **人格は registry 側で固定**、router 側では動かさない。tier（モデルの重さ）が変わっても
  identity セクションは同じものを注入し、「1人の相棒」として一貫させる（外は単一AIに見せる、D1）。
  → 軽量tierにも identity プロンプトは**必ず**載せる（プロンプトは軽く、人格だけは残す）。
- レコードの `tools` は [06-tools](../06-tools/) の `ShellPolicy.allow` そのもの＝許可コマンド集合。
- 自己拡張で生まれた専門サブエージェントもここに登録される（→ [07-metacognition](../07-metacognition/) / [06-tools](../06-tools/)）。

## SDKフック
- persona注入：`CascadePlannerConfig.promptSectionCustomizationConfig`（[system-prompt-control](../../api/system-prompt-control.md)）。
- 起動：`startCascade` の `customAgentSpec` に persona/prompt customization を載せてcascade全体へ適用。

## 未決事項
- レコードの永続化（ファイル/SQLite）。
- persona の記述形式（プレーンテキスト？構造化？）。
- 記憶をどこまでregistryに持たせ、どこから [05-memory](../05-memory/) 参照にするか。

## 関連
- [01-kernel](../01-kernel/) dispatch元 / [03-router](../03-router/) tier / [06-tools](../06-tools/) 許可集合 / [08-governance](../08-governance/) 予算
