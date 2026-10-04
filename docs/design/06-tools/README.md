# 06 — ツール (Shell実行 / MCP不使用)

**スコープ**（D2）：**MCPは使わない**。能力＝シェルコマンド。外部作用は `safeShell` という単一ゲートに
集約し、手前に許可・サンドボックス・承認を置く。Web操作・PC操作・画面もここに属する。旧 `tools-shell.md` を移設。

## 小分けドキュメント計画

- [ ] `safe-shell.md` — 唯一ゲート `safeShell` と `ShellPolicy`（※下に知見、切り出し候補）
- [ ] `skill-self-extension.md` — スクリプトを自作して `skills/` に登録する自己拡張
- [ ] `web.md` — curl / shellで簡易ブラウザを構築、非公式APIの自己構築
- [ ] `macos-control.md` — AppleScript等でPC操作（起動タスク監視/ディスク/ファイル整理）
- [ ] `screen.md` — 画面の観測/操作（スクショ・アクセシビリティ、深さは未決）

## なぜMCPより良い（この用途で）

- **自己拡張と相性**：賢くなる＝スクリプト1本書いて `skills/` に置くだけ。MCPは実装/起動/スキーマ登録が要る。
- **観測が楽**：全能力が「コマンド文字列＋stdout/stderr/exit」に正規化 → ログ・監査・メタ認知が一様。
- **依存が薄い**：常駐サーバ群を持たない。killswitch は「shell実行を止める」一点でよい。

## 現時点の知見

### 唯一ゲート：SafeShell（憲法の執行点）

```ts
interface ShellPolicy {
  allow: RegExp[];            // 許可（agentごと= registry.tools）
  deny: RegExp[];             // 明示禁止（rm -rf /, 認証情報, 外向き送信…）
  requireApproval: RegExp[];  // 実行前に人間承認（書き込み/ネットワーク/sudo）
  cwd: string; timeoutMs: number; budget: Budget;
}
interface ShellResult { cmd: string; stdout: string; stderr: string; code: number; ms: number; }
async function safeShell(cmd: string, policy: ShellPolicy): Promise<ShellResult>;
```
判定順：**deny → requireApproval → allow**。allowに無ければ拒否（デフォルト拒否）。

**最低限の安全策**：デフォルト拒否 / 書き込み・ネットワーク・sudo・パッケージ導入は承認 /
cwd固定・`..`脱出封じ / 秘密情報遮断（`~/.ssh` `~/.aws` deny・env絞り） / 予算（実行回数・時間上限） /
全件監査ログ / 危険パターン（`rm -rf`, `| sh`, 外部`curl`/`scp`）は deny か要承認。

### 自己拡張（Shellだからこそ簡単）

```
1. 繰り返す手順に気づく
2. スクリプトを ~/.runtime/skills/<name>.sh に書く      (書き込み=要承認)
3. registry.tools に allow: /skills\/<name>\.sh/ を1行追加 (要承認)
4. 次回から safeShell("skills/<name>.sh ...") で自分の道具に
```
MCPの「サーバ→スキーマ→起動」に対し shell は「ファイル1つ＋許可1行」。allow編集自体を要承認にして
勝手に権限を広げさせない。

### 持たせ方（persona側）
- cascade のツールを shell 実行系に絞る（`toolNames` 最小化、[system-prompt-control](../../api/system-prompt-control.md)）。
  人格＝[02-registry](../02-registry/) の persona、能力＝`ShellPolicy.allow`。

## 未決事項
- サンドボックス強度（policy判定のみ / コンテナ / macOS `sandbox-exec`）。
- 承認UI（CLIプロンプト / 通知 / 自発介入時の非同期承認）。
- `skills/` の言語（`.sh` 固定 / `ts`,`py` 許可）。
- 画面操作の深さ（観測のみ / 操作まで）。

## 関連
- [08-governance](../08-governance/) safeShellはその執行点 / [03-router](../03-router/) 外部作用は最低T2 / [07-metacognition](../07-metacognition/) 自己拡張の判断
