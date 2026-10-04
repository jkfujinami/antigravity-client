# 07 — メタ認知 (自己採点 / 再帰的プロンプト改善)

**スコープ**：Runtime が放っておいても賢くなる仕組み。自分の実行を振り返って採点し、
助言・失敗・成功から**自分の方針プロンプトを書き換える**。ただし暴走防止（版管理・承認・ロールバック）付き。

## 小分けドキュメント計画

- [ ] `self-critique.md` — trajectory を読み返して自己採点、失敗パターンを記憶へ蓄積
- [ ] `recursive-prompt-improvement.md` — `replace_prompt_sections` で persona/方針を自己更新（版管理必須）
- [ ] `cost-awareness.md` — `modelUsage` から自分のコストを自覚し、次回のtier選択を最適化
- [ ] `intervention-tuning.md` — 無視/感謝の履歴から「いつ喋るべきか」を学習（沈黙も能力）。監視閾値(D6)の自己チューニングもここ
- [ ] `council.md` — 内なる評議会（楽観/懐疑/コスト番人が内部議論して1答）

## 現時点の知見（自己改善3本柱）

1. **スキル開発** — 繰り返す手順を shell スクリプト化して登録（[06-tools](../06-tools/) 自己拡張）。
2. **ナレッジグラフ** — 得た知識/人物/関係を書庫に蓄積（[05-memory](../05-memory/)）。
3. **再帰的システムプロンプト改善** — 助言・失敗・成功から persona/方針プロンプトを書き換える。
   - 機構は既存：`replace_prompt_sections` で identity/方針セクションを自己更新（[system-prompt-control](../../api/system-prompt-control.md)）。
   - **暴走防止（必須）**：自己書き換えは**版管理＋承認＋ロールバック可能**に。「悪化したら戻せる」を保証してから許す（[08-governance](../08-governance/)）。

- 実測の素材：各ターンの `step.metadata.modelUsage` と trajectory（[token-usage](../../api/token-usage.md)）。
- self-critique の結果は [03-router](../03-router/) の自信判定/エスカレーションにも供給。

## 未決事項
- 自己採点の基準（何を成功/失敗とするか。ユーザーの採用/やり直しをシグナルに？）。
- プロンプト自己書き換えの版管理形式と承認粒度。
- 評議会を常時回すか、難問(T3)時のみか。

## 関連
- [05-memory](../05-memory/) 蓄積先 / [06-tools](../06-tools/) スキル化 / [03-router](../03-router/) 自信判定 / [08-governance](../08-governance/) 自己改変の憲法
