# API Server API Dictionary

## EvalApiServerService

### GetChatMessage
- **RPC**: `rpc GetChatMessage(exa.api_server_pb.GetChatMessageRequest) returns (stream exa.api_server_pb.GetChatMessageResponse);`
- **Description**: チャット応答（ストリーミング）を取得し、評価モデルをテスト・実行する。


## ApiServerService

### GetStreamingExternalChatCompletions
- **RPC**: `rpc GetStreamingExternalChatCompletions(exa.api_server_pb.GetStreamingExternalChatCompletionsRequest) returns (stream exa.api_server_pb.GetStreamingExternalChatCompletionsResponse);`
- **Description**: 外部LLMによるストリーミングチャット補完応答を取得する。

### GetEmbeddings
- **RPC**: `rpc GetEmbeddings(exa.api_server_pb.GetEmbeddingsRequest) returns (exa.api_server_pb.GetEmbeddingsResponse);`
- **Description**: 指定したテキストからベクトル表現（埋め込み）を取得する。

### GetChatMessage
- **RPC**: `rpc GetChatMessage(exa.api_server_pb.GetChatMessageRequest) returns (stream exa.api_server_pb.GetChatMessageResponse);`
- **Description**: チャット応答をストリーミング形式で取得する。

### GetStreamingModelAPITextCompletion
- **RPC**: `rpc GetStreamingModelAPITextCompletion(exa.api_server_pb.GetStreamingModelAPITextCompletionRequest) returns (stream exa.api_server_pb.GetStreamingModelAPITextCompletionResponse);`
- **Description**: モデルAPIを通じてテキスト補完のストリーム応答を取得する。

### GetTeamOrganizationalControls
- **RPC**: `rpc GetTeamOrganizationalControls(exa.api_server_pb.GetTeamOrganizationalControlsRequest) returns (exa.api_server_pb.GetTeamOrganizationalControlsResponse);`
- **Description**: 所属チーム向けの管理コントロール・制限設定を取得する。

### GetTeamOrganizationalControlsForSite
- **RPC**: `rpc GetTeamOrganizationalControlsForSite(exa.api_server_pb.GetTeamOrganizationalControlsForSiteRequest) returns (exa.api_server_pb.GetTeamOrganizationalControlsForSiteResponse);`
- **Description**: 指定サイト（ドメイン・拠点）向けチーム管理設定を取得する。

### UpsertTeamOrganizationalControls
- **RPC**: `rpc UpsertTeamOrganizationalControls(exa.api_server_pb.UpsertTeamOrganizationalControlsRequest) returns (exa.api_server_pb.UpsertTeamOrganizationalControlsResponse);`
- **Description**: 所属チーム向けの管理コントロール設定を作成・更新する。

### UpsertTeamOrganizationalControlsForSite
- **RPC**: `rpc UpsertTeamOrganizationalControlsForSite(exa.api_server_pb.UpsertTeamOrganizationalControlsForSiteRequest) returns (exa.api_server_pb.UpsertTeamOrganizationalControlsForSiteResponse);`
- **Description**: 指定サイト向けチーム管理設定を作成・更新する。

### DeleteTeamOrganizationalControls
- **RPC**: `rpc DeleteTeamOrganizationalControls(exa.api_server_pb.DeleteTeamOrganizationalControlsRequest) returns (exa.api_server_pb.DeleteTeamOrganizationalControlsResponse);`
- **Description**: 所属チーム向けの管理コントロール設定を削除する。

### GetMQuery
- **RPC**: `rpc GetMQuery(exa.api_server_pb.GetMQueryRequest) returns (exa.api_server_pb.GetMQueryResponse);`
- **Description**: 内部で保持しているMQuery（検索/インデックスに関するクエリ）のデータを取得する。

### ProvideFeedback
- **RPC**: `rpc ProvideFeedback(exa.api_server_pb.ProvideFeedbackRequest) returns (exa.api_server_pb.ProvideFeedbackResponse);`
- **Description**: ユーザーによるシステムフィードバックを記録する。

### UploadErrorTraces
- **RPC**: `rpc UploadErrorTraces(exa.api_server_pb.UploadErrorTracesRequest) returns (exa.api_server_pb.UploadErrorTracesResponse);`
- **Description**: 発生したエラーのスタックトレース等のログデータをサーバーにアップロードする。

### RecordOpportunities
- **RPC**: `rpc RecordOpportunities(exa.api_server_pb.RecordOpportunitiesRequest) returns (exa.api_server_pb.RecordOpportunitiesResponse);`
- **Description**: 補完などの提案機会があったことを集計用に記録する。

### RecordCodeTrackerUpdates
- **RPC**: `rpc RecordCodeTrackerUpdates(exa.api_server_pb.RecordCodeTrackerUpdatesRequest) returns (exa.api_server_pb.RecordCodeTrackerUpdatesResponse);`
- **Description**: IDE側で監視したコード変更履歴トラッカーの更新情報を記録する。

### RecordCompletionExample
- **RPC**: `rpc RecordCompletionExample(exa.api_server_pb.RecordCompletionExampleRequest) returns (exa.api_server_pb.RecordCompletionExampleResponse);`
- **Description**: 学習または分析用にコード補完の事例データを記録する。

### GetCompletionExamples
- **RPC**: `rpc GetCompletionExamples(exa.api_server_pb.GetCompletionExamplesRequest) returns (exa.api_server_pb.GetCompletionExamplesResponse);`
- **Description**: 保存されているコード補完事例のリストを取得する。

### RecordCompletions
- **RPC**: `rpc RecordCompletions(exa.analytics_pb.RecordCompletionsRequest) returns (exa.analytics_pb.RecordCompletionsResponse);`
- **Description**: 実行されたコード補完の結果・統計データを記録する。

### RecordAsyncTelemetry
- **RPC**: `rpc RecordAsyncTelemetry(exa.api_server_pb.RecordAsyncTelemetryRequest) returns (exa.api_server_pb.RecordAsyncTelemetryResponse);`
- **Description**: 非同期に収集されたシステム利用のテレメトリを記録する。

### RecordChat
- **RPC**: `rpc RecordChat(exa.api_server_pb.RecordChatRequest) returns (exa.api_server_pb.RecordChatResponse);`
- **Description**: チャットの対話履歴をサーバーに記録する。

### RecordChatFeedback
- **RPC**: `rpc RecordChatFeedback(exa.api_server_pb.RecordChatFeedbackRequest) returns (exa.api_server_pb.RecordChatFeedbackResponse);`
- **Description**: チャット回答に対する評価フィードバックを記録する。

### RecordChatPanelSession
- **RPC**: `rpc RecordChatPanelSession(exa.api_server_pb.RecordChatPanelSessionRequest) returns (exa.api_server_pb.RecordChatPanelSessionResponse);`
- **Description**: チャットパネルの使用セッション稼働ログを記録する。

### RecordContextRefresh
- **RPC**: `rpc RecordContextRefresh(exa.api_server_pb.RecordContextRefreshRequest) returns (exa.api_server_pb.RecordContextRefreshResponse);`
- **Description**: コンテキスト（開いているファイルやワークスペース等）のリフレッシュイベントを記録する。

### RecordContextToPrompt
- **RPC**: `rpc RecordContextToPrompt(exa.analytics_pb.RecordContextToPromptRequest) returns (exa.analytics_pb.RecordContextToPromptResponse);`
- **Description**: プロンプト構築に用いられたコンテキストの関連データを記録する。

### RecordEvent
- **RPC**: `rpc RecordEvent(exa.api_server_pb.RecordEventRequest) returns (exa.api_server_pb.RecordEventResponse);`
- **Description**: 製品内のイベント・利用実績データを記録する。

### RecordSearch
- **RPC**: `rpc RecordSearch(exa.api_server_pb.RecordSearchRequest) returns (exa.api_server_pb.RecordSearchResponse);`
- **Description**: 実行されたコード検索のクエリや条件を記録する。

### RecordSearchResults
- **RPC**: `rpc RecordSearchResults(exa.api_server_pb.RecordSearchResultsRequest) returns (exa.api_server_pb.RecordSearchResultsResponse);`
- **Description**: 検索により返された結果データを分析用に記録する。

### RecordSearchDocOpen
- **RPC**: `rpc RecordSearchDocOpen(exa.api_server_pb.RecordSearchDocOpenRequest) returns (exa.api_server_pb.RecordSearchDocOpenResponse);`
- **Description**: 検索結果からドキュメントを開いた実績を記録する。

### RecordSearchResultsView
- **RPC**: `rpc RecordSearchResultsView(exa.api_server_pb.RecordSearchResultsViewRequest) returns (exa.api_server_pb.RecordSearchResultsViewResponse);`
- **Description**: 検索結果ビューがユーザーに提示されたイベントを記録する。

### RecordDebounce
- **RPC**: `rpc RecordDebounce(exa.api_server_pb.RecordDebounceRequest) returns (exa.api_server_pb.RecordDebounceResponse);`
- **Description**: キー入力等のデバウンス（抑止）に関する統計データを記録する。

### RecordPinnedContext
- **RPC**: `rpc RecordPinnedContext(exa.api_server_pb.RecordPinnedContextRequest) returns (exa.api_server_pb.RecordPinnedContextResponse);`
- **Description**: ユーザーによってピン留めされたコンテキスト項目の設定情報を記録する。

### RecordCommandUsage
- **RPC**: `rpc RecordCommandUsage(exa.analytics_pb.RecordCommandUsageRequest) returns (exa.analytics_pb.RecordCommandUsageResponse);`
- **Description**: コマンドの利用頻度・ログを記録する。

### RecordChatModelNodeRun
- **RPC**: `rpc RecordChatModelNodeRun(exa.api_server_pb.RecordChatModelNodeRunRequest) returns (exa.api_server_pb.RecordChatModelNodeRunResponse);`
- **Description**: チャット推論における特定ノードの実行データを記録する。

### RecordMQuery
- **RPC**: `rpc RecordMQuery(exa.api_server_pb.RecordMQueryRequest) returns (exa.api_server_pb.RecordMQueryResponse);`
- **Description**: 検索/分析クエリ（MQuery）の実行ログを記録する。

### RecordCortexStep
- **RPC**: `rpc RecordCortexStep(exa.api_server_pb.RecordCortexStepRequest) returns (exa.api_server_pb.RecordCortexStepResponse);`
- **Description**: 自律エージェント（Cortex）の行動ステップのデータを記録する。

### RecordCommitMessageGeneration
- **RPC**: `rpc RecordCommitMessageGeneration(exa.api_server_pb.RecordCommitMessageGenerationRequest) returns (exa.api_server_pb.RecordCommitMessageGenerationResponse);`
- **Description**: コミットメッセージの自動生成が行われた実績を記録する。

### RecordCommitMessageSave
- **RPC**: `rpc RecordCommitMessageSave(exa.api_server_pb.RecordCommitMessageSaveRequest) returns (exa.api_server_pb.RecordCommitMessageSaveResponse);`
- **Description**: 生成後にユーザーが確定したコミットメッセージの内容を記録する。

### RecordGitTelemetry
- **RPC**: `rpc RecordGitTelemetry(exa.api_server_pb.RecordGitTelemetryRequest) returns (exa.api_server_pb.RecordGitTelemetryResponse);`
- **Description**: Git操作に関する統計情報を記録する。

### RecordProfilingData
- **RPC**: `rpc RecordProfilingData(stream exa.api_server_pb.RecordProfilingDataRequest) returns (exa.api_server_pb.RecordProfilingDataResponse);`
- **Description**: プロファイリング情報（CPU/Memory）をストリーミング送信して記録する。

### RecordReadUrlContent
- **RPC**: `rpc RecordReadUrlContent(exa.api_server_pb.RecordReadUrlContentRequest) returns (exa.api_server_pb.RecordReadUrlContentResponse);`
- **Description**: 外部URLコンテンツを読み取った実績を記録する。

### RecordNewCortexPlan
- **RPC**: `rpc RecordNewCortexPlan(exa.api_server_pb.RecordNewCortexPlanRequest) returns (exa.api_server_pb.RecordNewCortexPlanResponse);`
- **Description**: 自律エージェントが計画した新規プランの全体像を記録する。

### RecordCortexCodingPlan
- **RPC**: `rpc RecordCortexCodingPlan(exa.api_server_pb.RecordCortexCodingPlanRequest) returns (exa.api_server_pb.RecordCortexCodingPlanResponse);`
- **Description**: エージェントによるコーディング（実装）計画のデータを記録する。

### RecordCortexCodingStep
- **RPC**: `rpc RecordCortexCodingStep(exa.api_server_pb.RecordCortexCodingStepRequest) returns (exa.api_server_pb.RecordCortexCodingStepResponse);`
- **Description**: エージェントによる個々のコーディング行動ステップを記録する。

### RecordCortexCodingStepFeedback
- **RPC**: `rpc RecordCortexCodingStepFeedback(exa.api_server_pb.RecordCortexCodingStepFeedbackRequest) returns (exa.api_server_pb.RecordCortexCodingStepFeedbackResponse);`
- **Description**: コーディングのステップに対し得られた評価フィードバックを記録する。

### RecordCortexFeedback
- **RPC**: `rpc RecordCortexFeedback(exa.api_server_pb.RecordCortexFeedbackRequest) returns (exa.api_server_pb.RecordCortexFeedbackResponse);`
- **Description**: エージェントの実行全体に対するユーザーフィードバックを記録する。

### RecordCortexError
- **RPC**: `rpc RecordCortexError(exa.api_server_pb.RecordCortexErrorRequest) returns (exa.api_server_pb.RecordCortexErrorResponse);`
- **Description**: エージェント実行中に発生した内部エラー・例外情報を記録する。

### RecordCortexTrajectory
- **RPC**: `rpc RecordCortexTrajectory(exa.analytics_pb.RecordCortexTrajectoryRequest) returns (exa.analytics_pb.RecordCortexTrajectoryResponse);`
- **Description**: エージェントが辿った全軌跡のデータを記録する。

### RecordCortexTrajectoryStep
- **RPC**: `rpc RecordCortexTrajectoryStep(exa.analytics_pb.RecordCortexTrajectoryStepRequest) returns (exa.analytics_pb.RecordCortexTrajectoryStepResponse);`
- **Description**: 軌跡における個々のステップ履歴を記録する。

### RecordCortexGeneratorMetadata
- **RPC**: `rpc RecordCortexGeneratorMetadata(exa.api_server_pb.RecordCortexGeneratorMetadataRequest) returns (exa.api_server_pb.RecordCortexGeneratorMetadataResponse);`
- **Description**: 軌跡の生成器に関連する詳細メタデータを記録する。

### RecordCortexExecutionMetadata
- **RPC**: `rpc RecordCortexExecutionMetadata(exa.api_server_pb.RecordCortexExecutionMetadataRequest) returns (exa.api_server_pb.RecordCortexExecutionMetadataResponse);`
- **Description**: 軌跡の実行器に関連する詳細メタデータを記録する。

### RecordStateInitializationData
- **RPC**: `rpc RecordStateInitializationData(exa.api_server_pb.RecordStateInitializationDataRequest) returns (exa.api_server_pb.RecordStateInitializationDataResponse);`
- **Description**: エージェント初期化状態のデータを記録する。

### GetDefaultWorkflowTemplates
- **RPC**: `rpc GetDefaultWorkflowTemplates(exa.api_server_pb.GetDefaultWorkflowTemplatesRequest) returns (exa.api_server_pb.GetDefaultWorkflowTemplatesResponse);`
- **Description**: エージェントが使用するデフォルトのワークフローテンプレート一覧を取得する。

### BatchRecordPrompts
- **RPC**: `rpc BatchRecordPrompts(exa.analytics_pb.BatchRecordPromptsRequest) returns (exa.analytics_pb.BatchRecordPromptsResponse);`
- **Description**: 送信されたプロンプト群のログを一括で記録する。

### BatchRecordCompletions
- **RPC**: `rpc BatchRecordCompletions(exa.analytics_pb.BatchRecordCompletionsRequest) returns (exa.analytics_pb.BatchRecordCompletionsResponse);`
- **Description**: 補完結果のログを一括で記録する。

### BatchRecordUserLastUpdateTimes
- **RPC**: `rpc BatchRecordUserLastUpdateTimes(exa.api_server_pb.BatchRecordUserLastUpdateTimesRequest) returns (exa.api_server_pb.BatchRecordUserLastUpdateTimesResponse);`
- **Description**: ユーザーの最終アクティビティ時刻を一括で記録する。

### BatchRecordChatRequestRecords
- **RPC**: `rpc BatchRecordChatRequestRecords(exa.api_server_pb.BatchRecordChatRequestRecordsRequest) returns (exa.api_server_pb.BatchRecordChatRequestRecordsResponse);`
- **Description**: チャットリクエストの詳細ログを一括で記録する。

### Ping
- **RPC**: `rpc Ping(exa.api_server_pb.PingRequest) returns (exa.api_server_pb.PingResponse);`
- **Description**: 接続性やサーバー生存を確認するための簡易疎通テスト。

### WhoAmI
- **RPC**: `rpc WhoAmI(exa.api_server_pb.WhoAmIRequest) returns (exa.api_server_pb.WhoAmIResponse);`
- **Description**: 現在の認証トークンからログイン中のユーザー識別情報を取得する。

### Subscribe
- **RPC**: `rpc Subscribe(exa.api_server_pb.SubscribeRequest) returns (exa.api_server_pb.SubscribeResponse);`
- **Description**: 通知やイベント購読処理を設定する。

### ValidateEmail
- **RPC**: `rpc ValidateEmail(exa.api_server_pb.ValidateEmailRequest) returns (exa.api_server_pb.ValidateEmailResponse);`
- **Description**: 登録等の目的で指定されたメールアドレスの有効性を検証する。

### ValidateRegistrationCode
- **RPC**: `rpc ValidateRegistrationCode(exa.api_server_pb.ValidateRegistrationCodeRequest) returns (exa.api_server_pb.ValidateRegistrationCodeResponse);`
- **Description**: ユーザー登録コードや招待コードの正当性を検証する。

### JoinWaitlist
- **RPC**: `rpc JoinWaitlist(exa.api_server_pb.JoinWaitlistRequest) returns (exa.api_server_pb.JoinWaitlistResponse);`
- **Description**: プレビュー版などのウェイトリストに参加登録する。

### ContactForm
- **RPC**: `rpc ContactForm(exa.api_server_pb.ContactFormRequest) returns (exa.api_server_pb.ContactFormResponse);`
- **Description**: 問い合わせフォームからの送信データを処理する。

### GetExtensionStats
- **RPC**: `rpc GetExtensionStats(exa.api_server_pb.GetExtensionStatsRequest) returns (exa.api_server_pb.GetExtensionStatsResponse);`
- **Description**: IDE拡張機能の使用統計やログデータを取得する。

### SubscribeToBlog
- **RPC**: `rpc SubscribeToBlog(exa.api_server_pb.SubscribeToBlogRequest) returns (exa.api_server_pb.SubscribeToBlogResponse);`
- **Description**: 公式ブログ等の通知受信用購読を登録する。

### UnsubscribeFromEmails
- **RPC**: `rpc UnsubscribeFromEmails(exa.api_server_pb.UnsubscribeFromEmailsRequest) returns (exa.api_server_pb.UnsubscribeFromEmailsResponse);`
- **Description**: メール配信の購読を解除する。

### SendReferralEmail
- **RPC**: `rpc SendReferralEmail(exa.api_server_pb.SendReferralEmailRequest) returns (exa.api_server_pb.SendReferralEmailResponse);`
- **Description**: 紹介メールなどを他ユーザー宛てに送信する。

### RunCodeAlignment
- **RPC**: `rpc RunCodeAlignment(exa.api_server_pb.RunCodeAlignmentRequest) returns (exa.api_server_pb.RunCodeAlignmentResponse);`
- **Description**: コードの位置合わせや整形処理を実行する。

### GenerateSyntheticRule
- **RPC**: `rpc GenerateSyntheticRule(exa.api_server_pb.GenerateSyntheticRuleRequest) returns (exa.api_server_pb.GenerateSyntheticRuleResponse);`
- **Description**: コード規約やルールのサンプルを自動生成する。

### GetUserAllowlist
- **RPC**: `rpc GetUserAllowlist(exa.api_server_pb.GetUserAllowlistRequest) returns (exa.api_server_pb.GetUserAllowlistResponse);`
- **Description**: 特定ユーザー向けの使用許可リストを取得する。

### InsertAllowlist
- **RPC**: `rpc InsertAllowlist(exa.api_server_pb.InsertAllowlistRequest) returns (exa.api_server_pb.InsertAllowlistResponse);`
- **Description**: 使用許可リストに新たな条件やユーザーを追加する。

### DeleteAllowlist
- **RPC**: `rpc DeleteAllowlist(exa.api_server_pb.DeleteAllowlistRequest) returns (exa.api_server_pb.DeleteAllowlistResponse);`
- **Description**: 使用許可リストから条件・ユーザーを削除する。

### GetAllowlist
- **RPC**: `rpc GetAllowlist(exa.api_server_pb.GetAllowlistRequest) returns (exa.api_server_pb.GetAllowlistResponse);`
- **Description**: 使用許可リストの設定情報を取得する。

### RegisterHybridDeployment
- **RPC**: `rpc RegisterHybridDeployment(exa.api_server_pb.RegisterHybridDeploymentRequest) returns (exa.api_server_pb.RegisterHybridDeploymentResponse);`
- **Description**: ローカルとクラウドを組み合わせたハイブリッドデプロイの設定を登録する。

### CreateHybridDeploymentInternal
- **RPC**: `rpc CreateHybridDeploymentInternal(exa.api_server_pb.CreateHybridDeploymentInternalRequest) returns (exa.api_server_pb.CreateHybridDeploymentInternalResponse);`
- **Description**: ハイブリッドデプロイ環境を内部的に作成する。

### RemoveHybridDeploymentInternal
- **RPC**: `rpc RemoveHybridDeploymentInternal(exa.api_server_pb.RemoveHybridDeploymentInternalRequest) returns (exa.api_server_pb.RemoveHybridDeploymentInternalResponse);`
- **Description**: ハイブリッドデプロイ環境を削除する。

### GetHybridDeploymentsInternal
- **RPC**: `rpc GetHybridDeploymentsInternal(exa.api_server_pb.GetHybridDeploymentsInternalRequest) returns (exa.api_server_pb.GetHybridDeploymentsInternalResponse);`
- **Description**: 登録されているハイブリッドデプロイ構成の一覧を取得する。

### CheckHybridDeploymentStatus
- **RPC**: `rpc CheckHybridDeploymentStatus(exa.api_server_pb.CheckHybridDeploymentStatusRequest) returns (exa.api_server_pb.CheckHybridDeploymentStatusResponse);`
- **Description**: ハイブリッドデプロイ環境の稼働状態をチェックする。

### LogCompletionsHybrid
- **RPC**: `rpc LogCompletionsHybrid(exa.api_server_pb.LogCompletionsHybridRequest) returns (exa.api_server_pb.LogCompletionsHybridResponse);`
- **Description**: ハイブリッド構成における補完ログを記録する。

### LogFeedbackHybrid
- **RPC**: `rpc LogFeedbackHybrid(exa.api_server_pb.LogFeedbackHybridRequest) returns (exa.api_server_pb.LogFeedbackHybridResponse);`
- **Description**: ハイブリッド構成におけるフィードバックログを記録する。

### LogChatHybrid
- **RPC**: `rpc LogChatHybrid(exa.api_server_pb.LogChatHybridRequest) returns (exa.api_server_pb.LogChatHybridResponse);`
- **Description**: ハイブリッド構成におけるチャット対話ログを記録する。

### GetStatus
- **RPC**: `rpc GetStatus(exa.api_server_pb.GetStatusRequest) returns (exa.api_server_pb.GetStatusResponse);`
- **Description**: APIサーバーの現在の稼働・ヘルスステータスを取得する。

### GetCascadeModelConfigs
- **RPC**: `rpc GetCascadeModelConfigs(exa.api_server_pb.GetCascadeModelConfigsRequest) returns (exa.api_server_pb.GetCascadeModelConfigsResponse);`
- **Description**: 利用可能なCascade向けモデル設定を取得する。

### GetCommandModelConfigs
- **RPC**: `rpc GetCommandModelConfigs(exa.api_server_pb.GetCommandModelConfigsRequest) returns (exa.api_server_pb.GetCommandModelConfigsResponse);`
- **Description**: コマンド実行用モデル設定を取得する。

### GetMcpServerTemplates
- **RPC**: `rpc GetMcpServerTemplates(exa.api_server_pb.GetMcpServerTemplatesRequest) returns (exa.api_server_pb.GetMcpServerTemplatesResponse);`
- **Description**: 利用可能なMCPサーバーのテンプレート設定を取得する。

### GetUnleashContextFields
- **RPC**: `rpc GetUnleashContextFields(exa.api_server_pb.GetUnleashContextFieldsRequest) returns (exa.api_server_pb.GetUnleashContextFieldsResponse);`
- **Description**: 機能トグルのUnleashで評価に必要となるコンテキスト項目を取得する。

### RecordTrajectorySegmentAnalytics
- **RPC**: `rpc RecordTrajectorySegmentAnalytics(exa.api_server_pb.RecordTrajectorySegmentAnalyticsRequest) returns (exa.api_server_pb.RecordTrajectorySegmentAnalyticsResponse);`
- **Description**: 軌跡（Trajectory）の特定セグメントに関する分析データを記録する。

### RecordFullTrajectoryAnalytics
- **RPC**: `rpc RecordFullTrajectoryAnalytics(exa.api_server_pb.RecordFullTrajectoryAnalyticsRequest) returns (exa.api_server_pb.RecordFullTrajectoryAnalyticsResponse);`
- **Description**: 軌跡全体の分析データを記録する。

### RecordTrajectorySegmentEvents
- **RPC**: `rpc RecordTrajectorySegmentEvents(exa.api_server_pb.RecordTrajectorySegmentEventsRequest) returns (exa.api_server_pb.RecordTrajectorySegmentEventsResponse);`
- **Description**: 軌跡セグメント内で発生したイベントの詳細を記録する。

### SupportsRemoteIndexing
- **RPC**: `rpc SupportsRemoteIndexing(exa.api_server_pb.SupportsRemoteIndexingRequest) returns (exa.api_server_pb.SupportsRemoteIndexingResponse);`
- **Description**: 接続先がリモートでのソースコードインデックス作成に対応しているかを判定する。

### GetModelStatuses
- **RPC**: `rpc GetModelStatuses(exa.api_server_pb.GetModelStatusesRequest) returns (exa.api_server_pb.GetModelStatusesResponse);`
- **Description**: 各言語モデルの提供・稼働ステータスを取得する。

### GetModelInfos
- **RPC**: `rpc GetModelInfos(exa.api_server_pb.GetModelInfosRequest) returns (exa.api_server_pb.GetModelInfosResponse);`
- **Description**: 各言語モデルの詳細仕様情報を取得する。

### GetDeploymentConfig
- **RPC**: `rpc GetDeploymentConfig(exa.api_server_pb.GetDeploymentConfigRequest) returns (exa.api_server_pb.GetDeploymentConfigResponse);`
- **Description**: デプロイに関連する環境設定情報を取得する。

### UpsertDeploymentConfig
- **RPC**: `rpc UpsertDeploymentConfig(exa.api_server_pb.UpsertDeploymentConfigRequest) returns (exa.api_server_pb.UpsertDeploymentConfigResponse);`
- **Description**: デプロイ設定を作成・更新する。

### RecordCascadeUsage
- **RPC**: `rpc RecordCascadeUsage(exa.api_server_pb.RecordCascadeUsageRequest) returns (exa.api_server_pb.RecordCascadeUsageResponse);`
- **Description**: Cascadeエージェントの使用量を記録する。

### ApplyTrajectoryHeuristics
- **RPC**: `rpc ApplyTrajectoryHeuristics(exa.api_server_pb.ApplyTrajectoryHeuristicsRequest) returns (exa.api_server_pb.ApplyTrajectoryHeuristicsResponse);`
- **Description**: 軌跡のパターンから問題検出や改善のためのヒューリスティック評価を実行する。

### GetWebSearchResults
- **RPC**: `rpc GetWebSearchResults(exa.api_server_pb.GetWebSearchResultsRequest) returns (exa.api_server_pb.GetWebSearchResultsResponse);`
- **Description**: Web検索結果を取得する。

### GetWebDocsOptions
- **RPC**: `rpc GetWebDocsOptions(exa.api_server_pb.GetWebDocsOptionsRequest) returns (exa.api_server_pb.GetWebDocsOptionsResponse);`
- **Description**: Webドキュメント検索の各種オプション設定を取得する。

### GetWebSearchRedirect
- **RPC**: `rpc GetWebSearchRedirect(exa.api_server_pb.GetWebSearchRedirectRequest) returns (exa.api_server_pb.GetWebSearchRedirectResponse);`
- **Description**: Web検索からのリダイレクト情報やURLを解決する。

### GetTranscription
- **RPC**: `rpc GetTranscription(exa.api_server_pb.GetTranscriptionRequest) returns (exa.api_server_pb.GetTranscriptionResponse);`
- **Description**: 音声書き起こしテキストを取得する。

### GetImageGeneration
- **RPC**: `rpc GetImageGeneration(exa.api_server_pb.GetImageGenerationRequest) returns (exa.api_server_pb.GetImageGenerationResponse);`
- **Description**: 指定したプロンプトから生成された画像データを取得する。

### RegisterOidcProvider
- **RPC**: `rpc RegisterOidcProvider(exa.api_server_pb.RegisterOidcProviderRequest) returns (exa.api_server_pb.RegisterOidcProviderResponse);`
- **Description**: 新たなOIDC（OpenID Connect）認証プロバイダを登録する。

### GetTeamOidcProviders
- **RPC**: `rpc GetTeamOidcProviders(exa.api_server_pb.GetTeamOidcProvidersRequest) returns (exa.api_server_pb.GetTeamOidcProvidersResponse);`
- **Description**: 所属チーム向けに設定されているOIDC認証プロバイダ一覧を取得する。

### GetAllOidcProviders
- **RPC**: `rpc GetAllOidcProviders(exa.api_server_pb.GetAllOidcProvidersRequest) returns (exa.api_server_pb.GetAllOidcProvidersResponse);`
- **Description**: 登録されているすべてのOIDC認証プロバイダを取得する。

### DeleteOidcProvider
- **RPC**: `rpc DeleteOidcProvider(exa.api_server_pb.DeleteOidcProviderRequest) returns (exa.api_server_pb.DeleteOidcProviderResponse);`
- **Description**: 設定されているOIDC認証プロバイダを削除する。

### GetOidcAuthorizationUrl
- **RPC**: `rpc GetOidcAuthorizationUrl(exa.api_server_pb.GetOidcAuthorizationUrlRequest) returns (exa.api_server_pb.GetOidcAuthorizationUrlResponse);`
- **Description**: OIDCによる認証認可を開始するための認可URLを取得する。

### ExchangeOidcCode
- **RPC**: `rpc ExchangeOidcCode(exa.api_server_pb.ExchangeOidcCodeRequest) returns (exa.api_server_pb.ExchangeOidcCodeResponse);`
- **Description**: OIDCの認可コードをアクセス/IDトークンへ交換する。

### RefreshOidcToken
- **RPC**: `rpc RefreshOidcToken(exa.api_server_pb.RefreshOidcTokenRequest) returns (exa.api_server_pb.RefreshOidcTokenResponse);`
- **Description**: OIDCのトークンをリフレッシュする。

### CreateTrajectoryShareStream
- **RPC**: `rpc CreateTrajectoryShareStream(stream exa.api_server_pb.CreateTrajectoryShareStreamRequest) returns (exa.api_server_pb.CreateTrajectoryShareStreamResponse);`
- **Description**: 軌跡データの共有ストリームを新規に作成する。

### FetchTrajectoryShare
- **RPC**: `rpc FetchTrajectoryShare(exa.api_server_pb.FetchTrajectoryShareRequest) returns (exa.api_server_pb.FetchTrajectoryShareResponse);`
- **Description**: 共有されている特定の軌跡データを取得する。

### DeleteTrajectoryShare
- **RPC**: `rpc DeleteTrajectoryShare(exa.api_server_pb.DeleteTrajectoryShareRequest) returns (exa.api_server_pb.DeleteTrajectoryShareResponse);`
- **Description**: 公開・共有されている軌跡データを削除する。

### FetchTrajectoryShareByUser
- **RPC**: `rpc FetchTrajectoryShareByUser(exa.api_server_pb.FetchTrajectoryShareByUserRequest) returns (exa.api_server_pb.FetchTrajectoryShareByUserResponse);`
- **Description**: 特定のユーザーが共有している軌跡データの一覧を取得する。

### GetCascadeNuxes
- **RPC**: `rpc GetCascadeNuxes(exa.api_server_pb.GetCascadeNuxesRequest) returns (exa.api_server_pb.GetCascadeNuxesResponse);`
- **Description**: 新規ユーザー体験（NUX）のガイド完了状況を取得する。

### IsConversationSharingBlocked
- **RPC**: `rpc IsConversationSharingBlocked(exa.api_server_pb.IsConversationSharingBlockedRequest) returns (exa.api_server_pb.IsConversationSharingBlockedResponse);`
- **Description**: 特定の会話共有がブロックされているかを判定する。

### StreamingTest
- **RPC**: `rpc StreamingTest(exa.api_server_pb.StreamingTestRequest) returns (stream exa.api_server_pb.StreamingTestResponse);`
- **Description**: ストリーミング接続テストを実行しダミーデータを応答し続ける。
