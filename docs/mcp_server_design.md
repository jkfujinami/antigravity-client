# Antigravity MCP Server — 設計と実装

Claude Code（メイン）から Antigravity（サブ）を呼び出し、検索・調査・推論を**別プロセスの非同期タスク**として委譲するための MCP サーバー。メインのコンテキストを汚さず・ブロックせずに、結果（要約）だけを回収する。

## 1. コンセプト

- **メインエージェント**: Claude Code（MCP ホスト）
- **サブエージェント**: Antigravity Cascade（独立 Language Server 上で実行）
- **橋渡し**: `mcp_server.ts`（stdio transport の MCP サーバー）

```
┌──────────────┐  stdio (MCP)  ┌─────────────────────────┐ Connect-RPC ┌──────────────┐
│ Claude Code  │ ────────────► │ mcp_server.ts           │ ──────────► │ Antigravity  │
│ (host agent) │ ◄──────────── │  AntigravityClient ×1   │ ◄────────── │ Language     │
└──────────────┘  tool result │  CascadeRegistry (Map)  │  stream     │ Server (LS)  │
                              └─────────────────────────┘             └──────────────┘
```

### プロトコル選定
Claude Code がネイティブに喋るのは **MCP**。A2A はネットワーク越しの対等エージェント間向けでオーバースペックなので、本件はローカル委譲に最適な **MCP（stdio）** で実装。

### 接続モデル：独立 LS（standalone）
MCP サーバーは起動中の Antigravity IDE に相乗りせず、`AntigravityClient.launch()` で**自前の独立 LS を起動**する（IDE 不要）。プロセス終了時に `launcher.stop()` で LS も落とす。

## 2. ツール一覧

| ツール | 実体 | ブロッキング | 返却 |
| :--- | :--- | :--- | :--- |
| `ag_fast_quick_ask` | `client.getModelResponse(prompt, model)` | 同期 | 回答テキスト（ステートレス・ツール無し） |
| `ag_quick_ask` | `startCascade()`→`run()`→要約→`dispose()` | 同期(timeout上限) | LLM 要約（`fullData`で生trace） |
| `ag_start_task` | `startCascade()`→`sendMessage()`（待たない）→登録 | 非同期 | `{cascadeId, title}` |
| `get_running_cascade` | レジストリ列挙 | 同期 | `[{cascadeId, status, ageSec, idleSec}]` |
| `ag_check_task` | `resolve()`→`getHistory()`→要約/生取得 | 同期 | `status` ＋ 要約／生テキスト／生trace |
| `ag_send_message` | `resolve()`→`sendMessage()`（既定）/`run()`（`wait`） | 既定非同期 | ack / 応答テキスト |
| `delete_cascade` | `cancel()`（5sタイムアウト）＋`dispose()`＋登録解除 | 同期 | `{disposed}` |
| `ag_get_turn_diff` | `lsClient.getTurnDiff()`→ローカルでunified diff生成 | 同期 | ターンの**コンパクト差分**＋増減行 |
| `ag_revert_turn` | `lsClient.revertToCascadeStep()`（要model） | 同期 | ディスクをターン単位で巻き戻し |
| `ag_reject_edit` | `WriteFile(post-state)`＋`acknowledgeCodeActionStep(accept:false, 理由)` | 同期 | **file/hunk単位でディスクに却下適用**＋理由をLSへ同期 |

### 引数スキーマ（zod）
```
ag_fast_quick_ask  { prompt, model? }
ag_quick_ask       { prompt, focus?, workspacePath?, model?, timeoutMs?, fullData? }
ag_start_task      { prompt, workspacePath?, model?, title? }
get_running_cascade{ }
ag_check_task      { cascadeId, focus?, sinceLastMessage?, rawText?, fullData? }
ag_send_message    { cascadeId, message, wait?, timeoutMs?, model? }
delete_cascade     { cascadeId }
ag_get_turn_diff   { cascadeId, stepIndex?, contextLines?, includeContents? }
ag_revert_turn     { cascadeId, stepIndex? }
ag_reject_edit     { cascadeId, reason, scope?(all|file|hunk), files?, rejectHunks?, feedbackOnly?, stepIndex? }
```

## 3. 要約（context 汚染回避の肝）

委譲の目的は「巨大な trajectory を親に流し込まないこと」。よって生 trace は返さず：

1. `renderTranscript()` で **thinking ＋ assistant text ＋ 主要ツールステップ**だけを抽出した簡潔なトランスクリプトを作る（noisy な system/meta ステップは除外、上限 60k 文字）。
2. それを `client.getModelResponse()` に渡し、**LS のモデル自身に自然言語で再要約**させる。このとき呼び出し側（Claude）の指示を `focus` 引数として要約プロンプトに織り込む。

### `ag_check_task` の出力モード（優先順位 `rawText` > `fullData` > 要約）
- **`rawText: true`** … `plannerResponse` の応答テキストを**要約せず逐語**で返す（`extractResponseText()`）。
- **`fullData: true`** … `renderTranscript()` の全文（thinking＋ツールステップ）を返す。
- **既定** … LLM 要約。
- **`sinceLastMessage: true`** … 末尾の `userInput` 以降（最新ターン）にスコープ。上記いずれのモードとも組み合わせ可能（`scopedSteps()`）。

## 4. 設計上の注意（実 API との差分）

- **サーバー側の「Cascade 削除」RPC は存在しない**。`delete_cascade` は実行中ターンの `cancel()` ＋ ローカル購読の `dispose()` ＋ レジストリ除去であって、LS 上の Cascade は残る。
- **`delete_cascade` の cancel はハングし得る**。非idle時の `cancel()` RPC は LS が詰まると返らないため、**5 秒タイムアウト**でガードし、その後 `dispose()`＋登録解除は確実に実行する（`registry.ts` の `CANCEL_TIMEOUT_MS`）。
- **`ag_start_task` は絶対に `run()` で待たない**。`sendMessage()` を使い即 `cascadeId` を返す。進捗は親が `ag_check_task` でポーリング。
- **MCP 再起動耐性**：レジストリはインメモリだが、`resolve()` が miss 時に `client.resumeCascade(id)` へフォールバックするため、`cascadeId` さえあれば再起動後も check/send/delete が機能する。
- **stdout 保護**：stdio transport は stdout を JSON-RPC に使う。client/launcher の `console.log` は protocol を壊すため、エントリ冒頭で `console.log`/`console.info` を stderr へリダイレクトする。
- **検索能力は workspace 依存**：`workspacePath` 引数 → `addTrackedWorkspace()` を送信前に呼び、対象を LS の index 対象にする。
- **モデル指定／デフォルト自動選択**：core の resolver は廃止済みラベル `Gemini_3_Flash` を既定にしており（カタログ更新で陳腐化）、未指定だと `getModelResponse` が 404 / not found になる。これを避けるため **MCP 層に `resolveModelId(client, name?)` を置き**、未指定時はライブカタログ（`getAvailableModels()`）から **Flash 系 → recommended → enabled** の順で動的に選んで全ツールに注入する（id はキャッシュ）。core には手を入れていない（report-only）。

## 5. ワークフロー

### A. 単発調査（throw-away）
1. Claude が `ag_quick_ask({prompt, focus})` を呼ぶ。
2. サブエージェントが調査し、`focus` に沿った要約だけ返る。

### B. 非同期の重いタスク
1. `ag_start_task` → `cascadeId` 受領、Claude は別作業を継続。
2. 数ターン後 `ag_check_task({cascadeId, focus})` で進捗確認。
3. 方向修正は `ag_send_message`。
4. 完了後 `delete_cascade` でリソース解放。

## 6. ファイル構成

```
src/server/mcp_server.ts      エントリ。launch()→stdio→ライフサイクル
src/server/mcp/registry.ts    CascadeRegistry（Map + resume フォールバック）
src/server/mcp/tools.ts       10 ツールの登録（McpServer + zod）
src/server/mcp/summarize.ts   renderTranscript() / extractResponseText() / summarizeTrajectory() / scopedSteps()
src/server/mcp/diff.ts        renderUnifiedDiff() / reconstructRejecting()（LCSベースの差分生成＋ハンク部分適用）
package.json bin              antigravity-mcp
```

既存の生成コード（`src/gen`）・facade には一切触れず、`src/core` の公開 API だけを呼ぶ薄いラッパに留めている。

## 7. 使い方

```bash
npm run build
# 開発時は tsx で直接
npm run mcp

# Claude Code へ登録（ビルド後）
claude mcp add antigravity -- node /abs/path/dist/src/server/mcp_server.js
```

## 8. トークン節約拡張と評価

委譲の真価は「**重い I/O・推論をサブ側のコンテキストで行い、親はコンパクトな差分だけ受け取る**」点にある。この観点で 3 案を検討し、実機評価した。

### 採用：`ag_get_turn_diff`（本丸）
- `lsClient.getTurnDiff(conversationId, stepIndex)` は変更前後の**全文**（`FileDiffData.originalContents/modifiedContents` ＋ 増減行）を返すため、`diff.ts` の `renderUnifiedDiff()`（LCS）で**ローカルに unified diff を生成**し、変更ハンク＋数行コンテキストだけ返す。
- `stepIndex` 省略時は末尾 `userInput` を探して**最新ターン**を対象にする。
- 評価：サブが作成→修正した実ファイルを**本文を読まずに**正確な差分でレビューできた（生成差分は実ファイルと一致）。実装委譲ループの中核。
- トレイリング改行は正規化して末尾の幻の空行差分を出さない。

### 不採用：`ag_search_code`（`SearchCode`）
- 独立起動 LS は**セマンティックインデックスが未構築**で、`startCascade` 検索が docs/README/examples ばかりを返し、定義元 `src/core/client.ts` を含む `src/` の実コードを取りこぼした。Claude 自身の `Grep` が即・完全・確定的に勝る。
- `connect`（稼働中 IDE）モードなら有効な可能性はあるが、本構成（standalone）ではコードナビにむしろ有害なため**削除**。

### 不採用：`ag_run_command`（`RunCommand`）
- Claude は既に `Bash` を持ち、巨大ログは `| tail` 等で自分で絞れる。委譲しても推論はオフロードされず出力は結局親に返るため、価値が薄い。**見送り**。

## 9. 差分の却下・巻き戻し（実機調査の結論）

「差分を理由付きで破棄」「file/hunk 単位の破棄」を実機プローブ（`test/test_reject_revert.ts` / `test/test_ack_edit.ts`）で検証した結果：

| 操作 | RPC | ディスク反映 | 粒度 |
| :--- | :--- | :---: | :--- |
| ターン巻き戻し | `revertToCascadeStep`（`overrideConfig` に model 必須） | ✅ 戻る | ターン単位 |
| 理由付き却下 | `acknowledgeCodeActionStep(accept:false, writtenFeedback)` | ❌ 書かない | scope=FILE/HUNK/ALL 指定可 |
| 内容指定 | `acknowledgeCascadeCodeEdit(contents[])` | ❌ 書かない | — |

- **acknowledge 系はそれ単体ではディスクを書き換えない**＝レビュー状態・学習用のフィードバック信号。`revertToCascadeStep` はターン単位で実ディスクを戻す。
- **IDE がどう部分 Reject しているか**（Ag 調査）：拡張が VS Code の `WorkspaceEdit` で**ファイルの該当箇所だけ「編集前」に書き戻し**、その後 `AcknowledgeCodeActionStep(REJECT, SCOPE=HUNK)` で「拒否した」メタデータを LS に同期する。フロントエンド UI は LS が `http://127.0.0.1:<port>/` で動的配信し asar には無い。

### 自前実装は容易だった（実証済み）
拡張の役割は「**書き戻し → LS へ ack 同期**」の 2 段。ack 同期は元々実装済みなので、足りなかったのは**書き戻しの一手**だけ。それは LS の **`WriteFile(uri, content, overwrite)` RPC**（拡張サーバ経由の 501 群とは別、LS 直処理）で代替できる。`test/test_writefile_reject.ts` で **hunk 単位 Reject が実ディスクに反映**されることを確認（modified `A=100,C=300` → hunk1=A だけ却下 → ディスク `A=1,C=300`）。

### 実装方針
- **`ag_revert_turn`**：`revertToCascadeStep` ＋ model 注入。ターン単位の**実ディスク巻き戻し**（ファイル作成の取り消し含む）。
- **`ag_reject_edit`**：`diff.ts` の `reconstructRejecting()` で目標 post-state を算出 → **`WriteFile` でディスクに書き戻し**（all/file は original 全文、hunk は部分適用後）→ `acknowledgeCodeActionStep(accept:false, writtenFeedback=理由, scope)` で LS へ同期。＝**file/hunk 単位の実ディスク Reject**。`feedbackOnly:true` で書き戻しを抑止し信号だけ送ることも可能。
