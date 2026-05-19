# Antigravity API & Model Structure Analysis

## 1. 概要と発見の経緯
Antigravity クライアントから、型定義された protobuf / Connect-RPC メッセージ型を活用してモデルスペック情報および認証連携エンドポイントを調査・検証した結果、以下の重大な構造が判明しました。

### ① API 実エンドポイントの特定
以前調査していた `antigravity.google` や `antigravity-unleash.goog` 宛ての接続は Web フロントエンドや Feature Flag 制御用の限定的なものであり、実際のチャット生成やモデル情報の取得を司る API サーバーの実体は以下であることが特定されました。
*   **Production Endpoint**: `https://cloudcode-pa.googleapis.com`
*   **Daily/Beta Endpoint**: `https://daily-cloudcode-pa.googleapis.com`
*   **モデル取得パス**: `/v1internal:fetchAvailableModels`
*   **ストリーミング生成パス**: `/v1internal:streamGenerateContent?alt=sse`

### ② Google OAuth2 トークン管理の仕組み
ローカルの SQLite データベース (`state.vscdb`) 内の `antigravityAuthStatus` に保存されているアクセストークン (`ya29.a0Aa7...`) は有効期限が **1時間** であり、直接 API サーバーに投げると `401 Unauthorized` が返る状態になります。
しかし、バックグラウンドで動作している **Language Server (LS)** はリフレッシュトークンを用いてメモリ上で常に有効な最新アクセストークンを保持・更新し続けています。

---

## 2. LS Connect-RPC 経由によるモデル一覧の取得
ローカルで起動中の LS のローカルポートに対して `LanguageServerService.GetAvailableModels` を呼び出すことで、認証情報を明示的に渡すことなく、型安全に完全なモデルデータを取得することができます。

### 実行スクリプトの場所
[test_get_models_via_ls_proper.ts](file:///Users/fujinami/github/antigravity-client/test/test_get_models_via_ls_proper.ts)

### 取得に成功したモデル一覧 (全18種)

| モデルID (Model ID) | 表示名 (Display Name) | Max Tokens | Max Output | 提供プロバイダ (API Provider) |
| :--- | :--- | :--- | :--- | :--- |
| **claude-sonnet-4-6** | Claude Sonnet 4.6 (Thinking) | 250,000 | 64,000 | ANTHROPIC (26) |
| **claude-opus-4-6-thinking** | Claude Opus 4.6 (Thinking) | 250,000 | 64,000 | ANTHROPIC (26) |
| **gpt-oss-120b-medium** | GPT-OSS 120B (Medium) | 131,072 | 32,768 | DEEPRAMB (31) |
| **gemini-pro-agent** | Gemini 3.1 Pro (High) | 1,048,576 | 65,535 | GOOGLE_GEMINI (24) |
| **gemini-3.1-pro-high** | Gemini 3.1 Pro (High) | 1,048,576 | 65,535 | GOOGLE_GEMINI (24) |
| **gemini-3.1-pro-low** | Gemini 3.1 Pro (Low) | 1,048,576 | 65,535 | GOOGLE_GEMINI (24) |
| **gemini-3-flash-agent** | Gemini 3 Flash | 1,048,576 | 65,536 | GOOGLE_GEMINI (24) |
| **gemini-3-flash** | Gemini 3 Flash | 1,048,576 | 65,536 | GOOGLE_GEMINI (24) |
| **gemini-3.1-flash-lite** | Gemini 3.1 Flash Lite | 1,048,576 | 65,535 | GOOGLE_GEMINI (24) |
| **gemini-2.5-pro** | Gemini 2.5 Pro | 1,048,576 | 65,535 | GOOGLE_GEMINI (24) |

---

## 3. レスポンスデータ構造の特徴
LS が取得する `GetAvailableModelsResponse` は、Google の内部 API `FetchAvailableModelsResponse` のシリアライズデータをそのままラップして返しています。

1.  **Map構造 (`models`)**
    `models` 配列はオブジェクトの単純なリストではなく、Connect-RPC における Map 構造の転送表現として `{ key: string, value: ModelInfo }` のキー・バリューペアの配列としてマッピングされています。
2.  **実験的パラメータ (`experiments`)**
    各モデルのメタデータには、モデルに注入される **システムプロンプトの通信スタイル・ルール** や、実行時の checkpointer 設計 (`CASCADE_USE_EXPERIMENT_CHECKPOINTER` 等) など、詳細な内部実験フラグが JSON 文字列形式で丸ごと格納されています。
