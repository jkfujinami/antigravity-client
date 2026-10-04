# 01 — カーネル (常駐デーモン)

**スコープ**：Runtime の心臓。常駐し、あらゆるトリガー源を1本のイベントバスに集約し、
自発発火をスケジュールし、コンテキストを汚さず効率的に回し続ける。自発介入の主体はここ。

## 小分けドキュメント計画（研究したら個別ファイルに割る）

- [ ] `event-bus.md` — トリガー源（時間/ファイル変更/通知/他agent発話/ブラウザ状態/センサ）の統一イベント型・購読
- [ ] `scheduler.md` — `schedule` ツール + cron による自発発火。周期/単発/条件発火
- [ ] `lifecycle.md` — 常駐プロセスの形態（単一Node常駐 / cron外部起動 / 併用）、起動・復帰・クラッシュ耐性
- [ ] `tiered-monitor-loop.md` — 段階的コスト制御ループ（D3）＋思考/発話分離（D5）。※下に知見あり、最優先で切り出す候補
- [ ] `pc-state-signals.md` — 監視する PC/状態信号のカタログ（全部shell取得）。※下に知見あり
- [ ] `thresholds-config.md` — LLM編集可能な閾値コンフィグ（D6）と自己チューニング
- [ ] `context-management.md` — 常駐本体を軽く保ち、重い調査を別cascadeに逃がす方式
- [ ] `event-model.md` — イベント駆動（D7）。長命cascade + `listen()` + `on()` 配線、`run()`不使用。※下に知見あり

## 現時点の知見

### 段階的コスト制御ループ（D3, 最重要）

「常駐で全部を高性能モデルに流す」は**コストを食い潰す**。階段状に絞る。
コスト節約は"文脈を痩せさせる"のではなく**"安いモデルを門番に置く"**で達成する（→ ルーターには状態を**生で**渡す。[03-router](../03-router/) の「状態の渡し方」）。

```
① 非LLM収集 (生の SystemState をポーリング。ほぼ無料)
   │  閾値超えの変化・発話・イベント候補だけ通す
   ▼
② 軽量ルーターモデルで一次トリアージ (生状態を渡す。実質タダ)
   │  大半はここで「通常/無視」判定 → 沈黙で戻る
   ▼  残った「要調査」だけ…
③ 高性能モデルに委任 = サイレントに原因調査【思考】
   └─ 判定を ```sys_json``` フェンスの JSON で返す（surface/priority/needs_confirm/escalate/message）
        ├─ 「普通のユーザー使用」 → surface=false → カーネルが握り潰す（沈黙）
        └─ 「意図じゃなさそう/異常」 → surface=true → カーネルが通知/確認（発話）
```

- **思考と発話の分離（D5）**：③の調査中の `Thinking` は常にサイレント。発話するかは**カーネルが Text をゲート**して決める
  （ツールに頼らない。理由は下の「検証で判明した重要事実」）。喋りすぎない相棒にする核。
- **軽量モデルが門番**：高性能モデル(③)を毎回呼ぶとコストが跳ねる。②で大半を安く棄却してから③へ。
- **委任＝別cascade/subagentを起こす**：常駐の文脈を汚さず、重い調査は独立コンテキストで。
- tier は [03-router](../03-router/) と共有。

### 閾値はLLMが編集可能なコンフィグ（D6）

発火閾値は固定値ではなく**エージェント自身が調整できるコンフィグ**にする。誤検知/無視された履歴から
自分で上げ下げする（介入さじ加減学習、[07-metacognition](../07-metacognition/)）。

- **自己チューニング**：「この通知いつも無視されてる → 閾値を上げる」を自分で反映。
- **暴走防止（憲法, [08-governance](../08-governance/)）**：閾値編集は**上下限クランプ＋版管理＋ロールバック**必須。
  閾値0（黙りきり）や無限（スパム/盲目）に振れないよう clamp。悪化したら戻せることを保証してから自己編集を許す。
- コンフィグの実体（ファイル/registry内）と編集手段（`safeShell` or 専用config操作）は未決。

### イベントバスの発想

- 全トリガーを `{ type, source, ts, payload, salience? }` に正規化して1本に流す。
- ブラウザ状態は `ADDITIONAL_METADATA` に乗ることを確認済み（[system-prompt-control](../../api/system-prompt-control.md)）→ 介入トリガに使える。

### cascade はイベント駆動で回す（D7）

`Cascade` は `EventEmitter`。`run()`（sendMessage+完了待ち+text収集の便利ラッパ）は**使わない** — 全出力がtextに
丸まって思考/発話の分離(D5)が潰れるため。常駐は次の形：

```ts
const cascade = await client.startCascade();  // listen() は内部で自動起動
cascade.on(CascadeEvents.Thinking,   e => log(e));          // 思考 = サイレント（出さない）
cascade.on(CascadeEvents.Text,       e => gateSpeech(e));   // 発話本文 = カーネルがゲート
cascade.on(CascadeEvents.StatusChange, e => track(e));      // idle/running
cascade.on(CascadeEvents.Interaction,  e => gateApproval(e)); // safeShell承認ゲート
// 監視ループは状況を投げ込むだけ（ブロックしない）:
cascade.sendMessage(situationText);
// 中断/バージイン:
cascade.cancel();
// 終了:
cascade.dispose();
```

| イベント | 意味 | 扱い |
|---|---|---|
| `Thinking` | 内部思考(逐次) | **サイレント**（ログのみ、ユーザーに出さない） |
| `Text` | 発話本文(`plannerResponse`, 逐次delta) | **カーネルがゲート**：surface判定で通すか握り潰す |
| `StatusChange` | ターン idle/running | 監視ループの状態管理 |
| `Interaction` | 承認要求 | safeShellのゲート（[06-tools](../06-tools/)） |

**⚠ 検証で判明した重要事実**（`scratch/exp_events_d5*.ts`）：
- デフォルト会話プランナーは**素のTextで返答**する（`plannerResponse`）。`Thinking`と`Text`は綺麗に分離できる ✅。
- **「ユーザーに喋る専用ツール」は無い**。`send_message` ツールは **エージェント間通信専用**（サブエージェント/ピア宛）で、
  ユーザーには届かない。→ 窓口として使えない。評議会/subagent（[07-metacognition](../07-metacognition/)）向け。

### 発話ゲート＝カーネルがTextを握る（D5の正しい実装、形式は実測で確定）

「必要な時だけ喋る」はツール呼び出しに頼れない（上記）。**カーネルがTextを見て通すか決める**。
出力形式を4方式で実測比較した（`scratch/exp_gate_format.ts` / `exp_gate_multitag.ts` / `exp_gate_json_stress.ts` / `exp_gate_sysjson.ts`）。

**確定：```sys_json``` フェンス内のJSON。**

トリアージにこう返させる：
```
（モデルはフェンス外で自由に思考を吐いてよい。機械はsys_jsonブロックだけ読む）
` ``sys_json
{"surface": true, "priority": "high", "needs_confirm": true, "escalate": false,
 "message": "ディスク残8%。~/Library/Logs が12GB。消しますか?"}
` ``
```

- **抽出は波括弧バランス方式**（終端フェンス `‥` に依存しない）。理由：message 内に ```lang…``` コードフェンスが
  **入れ子**で入ると、非貪欲regex `([\s\S]*?)‥` は最初の ``` で切れて壊れる。実モデルは実際に message へ
  ```javascript…``` を入れてくる（ライブ確認済み、`‥`が1出力に4個）。
  → `sys_json` マーカ以降で**最初のバランスした `{…}` を、文字列状態(inString/escape)を尊重して波括弧マッチ**で抜き、`JSON.parse`。
  これで message 内の ``` や `{ }` が何個あっても無関係（全部JSON文字列の内側）。**発話ゲート＝`surface===true`**。
- **フェイルセーフ段**：〈sys_jsonマーカ無し → 全文で最初のバランスJSON（```json```/素JSON両対応）→ 末尾カンマ等を軽微修復 →
  それも失敗なら生Textを `surface=true` で喋らせる〉。トリアージは閾値＋軽量ゲート通過後なので、重要通知を落とすより喋る方がまし。
- **実装＆テスト**：パーサは `scratch/gate_parser.ts`（`parseGateOutput()` / `extractSysJson()`）。
  ユニット13/13通過（入れ子```・内側`{ }`・4連バッククォート・深いネスト・末尾カンマ・フォールバック・沈黙・欠落補完）＋実モデル統合確認済み。

**なぜ sys_json が最善か（実測, デフォルトモデル・各24コール）**：

| 方式 | parse成功 | スキーマ | 散文混入耐性 | 構造(priority等) |
|---|---|---|---|---|
| plain JSON | 素96% / 寛容100% | 100% | ✗ 散文が混じると壊れる | ◎ |
| ```say``` 単一タグ | 発話ゲートは堅牢 | – | ◎ | ✗ 別タグは1/3でsay内にインライン |
| **```sys_json```** | **検出100% / parse100%** | **100%** | **◎ 22/24で外に散文→全無視で成功** | **◎ 全フィールドクリーン** |

- モデルは**フェンス外で"考えを声に出す"**（実測で220〜447バイトの散文が頻出）。plain JSONはこれで即死するが、
  sys_jsonブロックだけ抜くので完全に無視できる。一意タグなので message本文中の ```json``` とも衝突しない。
- 複数の制御タグを別フェンスにすると崩れる（```say```実験）が、**JSONは1オブジェクトなので priority/confirm/escalate が全部クリーンに取れる**。
- → **plain JSONの構造 ＋ フェンスの散文耐性 ＋ 一意タグの衝突回避** を全部持つ。
- surface判定の外れ(92%)は「公衆Wi-Fi→VPN推奨」「深夜作業→休息推奨」等の**判断差**で、形式崩れではない（むしろ妥当）。

**メタ情報はモデルが1コールで返す**：priority / needs_confirm / escalate も sys_json 内で取得（[03-router](../03-router/)委任判断や[08-governance](../08-governance/)確認フローに直結）。
カーネル側ルールで上書き/クランプしてよい（例: 発報信号がcriticalなら priority を強制high）。

⚠ **未検証**：実測は強いデフォルトモデル。実際のT0軽量モデルでの sys_json 安定性は tier確定後に再検証。崩れるなら ```say``` 単一タグ＋メタはカーネル計算に退避。

### 監視する PC/状態信号（全部shellで取得＝D2整合）

①非LLM層が `SystemState` として保持し、②ルーターに**生で**渡す（[03-router](../03-router/)「状態の渡し方」）。

| 信号 | 取得(shell例) | ポーリング | 機微 |
|---|---|---|---|
| 時刻/TZ | `date` | 常時 | - |
| 前面アプリ/ウィンドウ | `osascript`(System Events) / `lsappinfo front` | 5–15s | 中 |
| 在席/アイドル秒 | `ioreg -c IOHIDSystem`(HIDIdleTime) | 5–15s | - |
| 画面ロック/スリープ | `pmset -g` / `ioreg` | イベント | - |
| CPU/ロード | `sysctl -n vm.loadavg` / `top -l1` | 10–30s | - |
| メモリ圧 | `memory_pressure` / `vm_stat` | 10–30s | - |
| ディスク空き | `df -h` | 5–15min | - |
| バッテリ/電源 | `pmset -g batt` | 30–60s | - |
| ネット/SSID | `networksetup -getairportnetwork` / `ifconfig` | 変化時 | 中(場所推定) |
| 起動タスク/プロセス | `launchctl list` / `ps` | 1–5min | 中 |
| 接続デバイス(表示/BT) | `system_profiler` / `ioreg` | 変化時 | 低 |
| 予定(直近) | `osascript`(Calendar) / `icalBuddy` | 5–15min | **高** |
| クリップボード | `pbpaste` | **原則見ない** | **最高** |
| 位置(GPS) | CoreLocationヘルパ要 | 変化時 | **高** |
| 明るさ/温度 | `ioreg` / 3rd party | 30–60s | 低 |

- **生で渡す方針（D1補足）**：②の軽量ルーターは near-free なので、精度に効くなら state を惜しまず渡す。
  「毎プロンプトのトークンをケチる」より「安いモデルで判定する」を優先。
- **機微データの扱いは憲法連動**：`pbpaste`（クリップボード）・位置 は最高機微。
  **デフォルト収集しない／明示許可時のみ③でpull**（[08-governance](../08-governance/) allow制御）。予定は「粗さ」を選べるように（例: タイトル伏せ）。

## SDKフック

- 自発発火：`schedule` ツール / cron → 条件成立で `SendUserCascadeMessage`。
- 委任：新規 `startCascade` or subagent。

## 未決事項

- 常駐形態（単一Node常駐 vs cron起動 vs 併用）。
- 発火**閾値**の初期値（調整は D6 で自己チューニング方針は決定。初期値と clamp 範囲は未決）。
- 閾値コンフィグの実体（ファイル / registry内）と編集手段（`safeShell` / 専用config操作）。
- `SystemState` の保持構造と、③調査時に生shellを引くか保持値を使うか。
- 機微信号（クリップボード/位置/予定）のデフォルト収集ポリシー（[08-governance](../08-governance/) と確定）。

## 関連
- [03-router](../03-router/) tier / [04-perception](../04-perception/) 監視入力 / [05-memory](../05-memory/) 文脈退避 / [08-governance](../08-governance/) 予算
