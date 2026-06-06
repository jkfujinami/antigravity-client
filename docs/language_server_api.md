# Antigravity Language Server API Dictionary

### ProvideCompletionFeedback
- **RPC**: `rpc ProvideCompletionFeedback(exa.language_server_pb.ProvideCompletionFeedbackRequest) returns (exa.language_server_pb.ProvideCompletionFeedbackResponse);`
- **Description**: オートコンプリートの提示に対するユーザーのフィードバックを送信する。

### Heartbeat
- **RPC**: `rpc Heartbeat(exa.language_server_pb.HeartbeatRequest) returns (exa.language_server_pb.HeartbeatResponse);`
- **Description**: Language Serverとクライアント間の生存確認を行う。

### GetStatus
- **RPC**: `rpc GetStatus(exa.language_server_pb.GetStatusRequest) returns (exa.language_server_pb.GetStatusResponse);`
- **Description**: Language Serverの現在の稼働ステータスを取得する。

### GetCommandModelConfigs
- **RPC**: `rpc GetCommandModelConfigs(exa.language_server_pb.GetCommandModelConfigsRequest) returns (exa.language_server_pb.GetCommandModelConfigsResponse);`
- **Description**: コマンド実行用モデルの設定情報を取得する。

### GetCascadeModelConfigs
- **RPC**: `rpc GetCascadeModelConfigs(exa.language_server_pb.GetCascadeModelConfigsRequest) returns (exa.language_server_pb.GetCascadeModelConfigsResponse);`
- **Description**: Cascade（対話型エージェント）モデルの設定情報を取得する。

### GetStandaloneDir
- **RPC**: `rpc GetStandaloneDir(exa.language_server_pb.GetStandaloneDirRequest) returns (exa.language_server_pb.GetStandaloneDirResponse);`
- **Description**: スタンドアロン動作時のディレクトリパスを取得する。

### RecordEvent
- **RPC**: `rpc RecordEvent(exa.language_server_pb.RecordEventRequest) returns (exa.language_server_pb.RecordEventResponse);`
- **Description**: 利用統計やイベントログを記録する。

### RecordSidecarEvent
- **RPC**: `rpc RecordSidecarEvent(exa.language_server_pb.RecordSidecarEventRequest) returns (exa.language_server_pb.RecordSidecarEventResponse);`
- **Description**: サイドカープロセスに関するイベントを記録する。

### GetSidecars
- **RPC**: `rpc GetSidecars(exa.language_server_pb.GetSidecarsRequest) returns (exa.language_server_pb.GetSidecarsResponse);`
- **Description**: 稼働中のサイドカープロセス一覧を取得する。

### SubscribeToSidecars
- **RPC**: `rpc SubscribeToSidecars(exa.language_server_pb.SubscribeToSidecarsRequest) returns (stream exa.language_server_pb.SubscribeToSidecarsResponse);`
- **Description**: サイドカープロセスの起動・停止ステータス変更をストリーミングで受信する。

### GetSidecarEvents
- **RPC**: `rpc GetSidecarEvents(exa.language_server_pb.GetSidecarEventsRequest) returns (exa.language_server_pb.GetSidecarEventsResponse);`
- **Description**: サイドカーに関連するイベントログを取得する。

### GetSidecarLogs
- **RPC**: `rpc GetSidecarLogs(exa.language_server_pb.GetSidecarLogsRequest) returns (stream exa.language_server_pb.GetSidecarLogsResponse);`
- **Description**: 指定したサイドカーのログをストリーミングで取得する。

### ListSidecarLogFiles
- **RPC**: `rpc ListSidecarLogFiles(exa.language_server_pb.ListSidecarLogFilesRequest) returns (exa.language_server_pb.ListSidecarLogFilesResponse);`
- **Description**: サイドカーのログファイル一覧を取得する。

### ManageSidecar
- **RPC**: `rpc ManageSidecar(exa.language_server_pb.ManageSidecarRequest) returns (exa.language_server_pb.ManageSidecarResponse);`
- **Description**: サイドカープロセスの起動、停止、再起動、作成などの制御を行う。

### RegisterGdmUser
- **RPC**: `rpc RegisterGdmUser(exa.language_server_pb.RegisterGdmUserRequest) returns (exa.language_server_pb.RegisterGdmUserResponse);`
- **Description**: Google内部（GDM）向けユーザーを新規登録し認証キーを生成する。

### MigrateApiKey
- **RPC**: `rpc MigrateApiKey(exa.language_server_pb.MigrateApiKeyRequest) returns (exa.language_server_pb.MigrateApiKeyResponse);`
- **Description**: APIキーをセッショントークンへ移行・更新する。

### WellSupportedLanguages
- **RPC**: `rpc WellSupportedLanguages(exa.language_server_pb.WellSupportedLanguagesRequest) returns (exa.language_server_pb.WellSupportedLanguagesResponse);`
- **Description**: Language Serverがサポートするプログラミング言語の一覧を取得する。

### RecordSearchDocOpen
- **RPC**: `rpc RecordSearchDocOpen(exa.language_server_pb.RecordSearchDocOpenRequest) returns (exa.language_server_pb.RecordSearchDocOpenResponse);`
- **Description**: 検索結果からドキュメントを開いたイベントを記録する。

### RecordSearchResultsView
- **RPC**: `rpc RecordSearchResultsView(exa.language_server_pb.RecordSearchResultsViewRequest) returns (exa.language_server_pb.RecordSearchResultsViewResponse);`
- **Description**: 検索結果一覧が表示されたイベントを記録する。

### HandleStreamingCommand
- **RPC**: `rpc HandleStreamingCommand(exa.language_server_pb.HandleStreamingCommandRequest) returns (stream exa.language_server_pb.HandleStreamingCommandResponse);`
- **Description**: ストリーミング形式でチャットやコード生成のコマンド処理を行う。

### GetMcpServerTemplates
- **RPC**: `rpc GetMcpServerTemplates(exa.language_server_pb.GetMcpServerTemplatesRequest) returns (exa.language_server_pb.GetMcpServerTemplatesResponse);`
- **Description**: 利用可能なMCP（Model Context Protocol）サーバーのテンプレート一覧を取得する。

### AddTrackedWorkspace
- **RPC**: `rpc AddTrackedWorkspace(exa.language_server_pb.AddTrackedWorkspaceRequest) returns (exa.language_server_pb.AddTrackedWorkspaceResponse);`
- **Description**: 監視・インデックス対象のワークスペースを追加する。

### RemoveTrackedWorkspace
- **RPC**: `rpc RemoveTrackedWorkspace(exa.language_server_pb.RemoveTrackedWorkspaceRequest) returns (exa.language_server_pb.RemoveTrackedWorkspaceResponse);`
- **Description**: 監視対象のワークスペースを解除する。

### SmartFocusConversation
- **RPC**: `rpc SmartFocusConversation(exa.language_server_pb.SmartFocusConversationRequest) returns (exa.language_server_pb.SmartFocusConversationResponse);`
- **Description**: ユーザーのアクションに焦点を合わせたコンテキストの自動選択やフォーカスを適用する。

### StatUri
- **RPC**: `rpc StatUri(exa.language_server_pb.StatUriRequest) returns (exa.language_server_pb.StatUriResponse);`
- **Description**: 指定されたURIのファイル種別やサイズ、メタデータを取得する。

### ReadFile
- **RPC**: `rpc ReadFile(exa.language_server_pb.ReadFileRequest) returns (exa.language_server_pb.ReadFileResponse);`
- **Description**: 指定されたURIからファイルの内容を読み取る。

### CheckDevToolsActivePort
- **RPC**: `rpc CheckDevToolsActivePort(exa.language_server_pb.CheckDevToolsActivePortRequest) returns (exa.language_server_pb.CheckDevToolsActivePortResponse);`
- **Description**: Chrome DevToolsの有効ポート状況をチェックする。

### WriteFile
- **RPC**: `rpc WriteFile(exa.language_server_pb.WriteFileRequest) returns (exa.language_server_pb.WriteFileResponse);`
- **Description**: 指定されたURIへデータを書き込む。

### ReadDir
- **RPC**: `rpc ReadDir(exa.language_server_pb.ReadDirRequest) returns (exa.language_server_pb.ReadDirResponse);`
- **Description**: ディレクトリ内のファイルおよびサブディレクトリ一覧を取得する。

### DeleteFileOrDirectory
- **RPC**: `rpc DeleteFileOrDirectory(exa.language_server_pb.DeleteFileOrDirectoryRequest) returns (exa.language_server_pb.DeleteFileOrDirectoryResponse);`
- **Description**: 指定されたファイルまたはディレクトリを削除する。

### WatchDirectory
- **RPC**: `rpc WatchDirectory(exa.language_server_pb.WatchDirectoryRequest) returns (stream exa.language_server_pb.WatchDirectoryResponse);`
- **Description**: ディレクトリツリーへの変更を監視しストリーミング通知する。

### GetKnowledgeItems
- **RPC**: `rpc GetKnowledgeItems(exa.language_server_pb.GetKnowledgeItemsRequest) returns (exa.language_server_pb.GetKnowledgeItemsResponse);`
- **Description**: リポジトリに関連するナレッジ項目（Knowledge Items）の一覧を取得する。

### SetBrowserOpenConversation
- **RPC**: `rpc SetBrowserOpenConversation(exa.language_server_pb.SetBrowserOpenConversationRequest) returns (exa.language_server_pb.SetBrowserOpenConversationResponse);`
- **Description**: ブラウザ上でアクティブな対話スレッドを記録・設定する。

### GetBrowserOpenConversation
- **RPC**: `rpc GetBrowserOpenConversation(exa.language_server_pb.GetBrowserOpenConversationRequest) returns (exa.language_server_pb.GetBrowserOpenConversationResponse);`
- **Description**: 現在ブラウザで開かれている対話スレッドの情報を取得する。

### RefreshContextForIdeAction
- **RPC**: `rpc RefreshContextForIdeAction(exa.language_server_pb.RefreshContextForIdeActionRequest) returns (exa.language_server_pb.RefreshContextForIdeActionResponse);`
- **Description**: エディタ保存やアクティブタブ切り替えなどのIDEアクション契機で、コンテキスト情報を再構築する。

### GetMatchingContextScopeItems
- **RPC**: `rpc GetMatchingContextScopeItems(exa.language_server_pb.GetMatchingContextScopeItemsRequest) returns (exa.language_server_pb.GetMatchingContextScopeItemsResponse);`
- **Description**: 入力クエリに合致する範囲のコードやファイルをコンテキストとして取得する。

### RecordChatFeedback
- **RPC**: `rpc RecordChatFeedback(exa.language_server_pb.RecordChatFeedbackRequest) returns (exa.language_server_pb.RecordChatFeedbackResponse);`
- **Description**: チャット応答に対する評価フィードバックを記録する。

### RecordChatPanelSession
- **RPC**: `rpc RecordChatPanelSession(exa.language_server_pb.RecordChatPanelSessionRequest) returns (exa.language_server_pb.RecordChatPanelSessionResponse);`
- **Description**: チャットパネルの使用セッション（開始・終了時間）を記録する。

### ShouldEnableUnleash
- **RPC**: `rpc ShouldEnableUnleash(exa.language_server_pb.ShouldEnableUnleashRequest) returns (exa.language_server_pb.ShouldEnableUnleashResponse);`
- **Description**: 機能フラグ配信ツール（Unleash）の有効・無効を判定する。

### GetWorkspaceEditState
- **RPC**: `rpc GetWorkspaceEditState(exa.language_server_pb.GetWorkspaceEditStateRequest) returns (exa.language_server_pb.GetWorkspaceEditStateResponse);`
- **Description**: ワークスペース全体の変更状態や編集行数を取得する。

### GetRepoInfos
- **RPC**: `rpc GetRepoInfos(exa.language_server_pb.GetRepoInfosRequest) returns (exa.language_server_pb.GetRepoInfosResponse);`
- **Description**: リポジトリのブランチ情報やSCMの種類などを取得する。

### GetWorkspaceInfos
- **RPC**: `rpc GetWorkspaceInfos(exa.language_server_pb.GetWorkspaceInfosRequest) returns (exa.language_server_pb.GetWorkspaceInfosResponse);`
- **Description**: ホームディレクトリやアクティブワークスペースのURI群を取得する。

### GetLocalUserInfo
- **RPC**: `rpc GetLocalUserInfo(exa.language_server_pb.GetLocalUserInfoRequest) returns (exa.language_server_pb.GetLocalUserInfoResponse);`
- **Description**: ローカルのユーザー名、ホームディレクトリのURI、ホストOSの種類などを取得する。

### ResolveWorkspaceUrlPreview
- **RPC**: `rpc ResolveWorkspaceUrlPreview(exa.language_server_pb.ResolveWorkspaceUrlPreviewRequest) returns (exa.language_server_pb.ResolveWorkspaceUrlPreviewResponse);`
- **Description**: ワークスペース内のURLからプレビュー情報やリンク先を解決する。

### CreateWorktree
- **RPC**: `rpc CreateWorktree(exa.language_server_pb.CreateWorktreeRequest) returns (exa.language_server_pb.CreateWorktreeResponse);`
- **Description**: テストや試行用の隔離された作業領域（Git Worktree）を新規作成する。

### DeleteWorktree
- **RPC**: `rpc DeleteWorktree(exa.language_server_pb.DeleteWorktreeRequest) returns (exa.language_server_pb.DeleteWorktreeResponse);`
- **Description**: 不要になった作業領域（Git Worktree）を削除する。

### CheckoutWorktree
- **RPC**: `rpc CheckoutWorktree(exa.language_server_pb.CheckoutWorktreeRequest) returns (exa.language_server_pb.CheckoutWorktreeResponse);`
- **Description**: 作成したワークツリーの内容をメインのワークスペースにマージして適用する。

### GetWorktreeDiff
- **RPC**: `rpc GetWorktreeDiff(exa.language_server_pb.GetWorktreeDiffRequest) returns (exa.language_server_pb.GetWorktreeDiffResponse);`
- **Description**: 作成したワークツリーとメインのワークスペースの差分パッチを取得する。

### CreateCitcWorkspace
- **RPC**: `rpc CreateCitcWorkspace(exa.language_server_pb.CreateCitcWorkspaceRequest) returns (exa.language_server_pb.CreateCitcWorkspaceResponse);`
- **Description**: Google内部システム（Citc）のワークスペースを新規作成する。

### SetWorkingDirectories
- **RPC**: `rpc SetWorkingDirectories(exa.language_server_pb.SetWorkingDirectoriesRequest) returns (exa.language_server_pb.SetWorkingDirectoriesResponse);`
- **Description**: アクティブな作業ディレクトリリストを設定する。

### GetWorkingDirectories
- **RPC**: `rpc GetWorkingDirectories(exa.language_server_pb.GetWorkingDirectoriesRequest) returns (exa.language_server_pb.GetWorkingDirectoriesResponse);`
- **Description**: Language Serverが追跡している作業ディレクトリの一覧を取得する。

### GetRevisionArtifact
- **RPC**: `rpc GetRevisionArtifact(exa.language_server_pb.GetRevisionArtifactRequest) returns (exa.language_server_pb.GetRevisionArtifactResponse);`
- **Description**: バージョン管理の特定コミット・リビジョンにおける成果物を取得する。

### GenerateCommitMessage
- **RPC**: `rpc GenerateCommitMessage(exa.language_server_pb.GenerateCommitMessageRequest) returns (exa.language_server_pb.GenerateCommitMessageResponse);`
- **Description**: ワークスペースの差分を元にGitのコミットメッセージを自動生成する。

### RecordCommitMessageSave
- **RPC**: `rpc RecordCommitMessageSave(exa.language_server_pb.RecordCommitMessageSaveRequest) returns (exa.language_server_pb.RecordCommitMessageSaveResponse);`
- **Description**: 実際に保存されたコミットメッセージとメタデータを記録する。

### UpdatePRForWorktree
- **RPC**: `rpc UpdatePRForWorktree(exa.language_server_pb.UpdatePRForWorktreeRequest) returns (exa.language_server_pb.UpdatePRForWorktreeResponse);`
- **Description**: ワークツリーの変更からプルリクエスト（PR）を新規作成または更新する。

### SendActionToChatPanel
- **RPC**: `rpc SendActionToChatPanel(exa.language_server_pb.SendActionToChatPanelRequest) returns (exa.language_server_pb.SendActionToChatPanelResponse);`
- **Description**: チャットUI側のパネルに対し特定のアクション要求（メッセージ表示等）を送信する。

### GetUserSettings
- **RPC**: `rpc GetUserSettings(exa.language_server_pb.GetUserSettingsRequest) returns (exa.language_server_pb.GetUserSettingsResponse);`
- **Description**: エージェントや拡張機能のユーザー設定値を取得する。

### SetUserSettings
- **RPC**: `rpc SetUserSettings(exa.language_server_pb.SetUserSettingsRequest) returns (exa.language_server_pb.SetUserSettingsResponse);`
- **Description**: ユーザー設定値を更新する。

### FetchUserInfo
- **RPC**: `rpc FetchUserInfo(exa.language_server_pb.FetchUserInfoRequest) returns (exa.language_server_pb.FetchUserInfoResponse);`
- **Description**: サインインしているユーザーのプロファイル情報を取得する。

### SetUserInfo
- **RPC**: `rpc SetUserInfo(exa.language_server_pb.SetUserInfoRequest) returns (exa.language_server_pb.SetUserInfoResponse);`
- **Description**: ユーザーの属性情報を設定・更新する。

### GetDebugDiagnostics
- **RPC**: `rpc GetDebugDiagnostics(exa.language_server_pb.GetDebugDiagnosticsRequest) returns (exa.language_server_pb.GetDebugDiagnosticsResponse);`
- **Description**: Language Serverの内部統計やデバッグ診断情報を取得する。

### DumpFlightRecorder
- **RPC**: `rpc DumpFlightRecorder(exa.language_server_pb.DumpFlightRecorderRequest) returns (exa.language_server_pb.DumpFlightRecorderResponse);`
- **Description**: 内部イベント履歴やトレース（フライトレコーダー）をディスクにダンプする。

### DumpPprof
- **RPC**: `rpc DumpPprof(exa.language_server_pb.DumpPprofRequest) returns (exa.language_server_pb.DumpPprofResponse);`
- **Description**: Goなどのpprofプロファイリングデータをダンプする。

### GetUserAnalyticsSummary
- **RPC**: `rpc GetUserAnalyticsSummary(exa.language_server_pb.GetUserAnalyticsSummaryRequest) returns (exa.language_server_pb.GetUserAnalyticsSummaryResponse);`
- **Description**: 指定期間のコード補完回数やチャット使用状況などの利用統計を集計する。

### GetUserStatus
- **RPC**: `rpc GetUserStatus(exa.language_server_pb.GetUserStatusRequest) returns (exa.language_server_pb.GetUserStatusResponse);`
- **Description**: ユーザーのプラン種別やステータスを取得する。

### GetProfileData
- **RPC**: `rpc GetProfileData(exa.language_server_pb.GetProfileDataRequest) returns (exa.language_server_pb.GetProfileDataResponse);`
- **Description**: ユーザーのアバター画像URL等のプロファイル詳細を取得する。

### GetChangelog
- **RPC**: `rpc GetChangelog(exa.language_server_pb.GetChangelogRequest) returns (exa.language_server_pb.GetChangelogResponse);`
- **Description**: 指定バージョンの変更履歴（チェンジログ）のパスを取得する。

### SetupUniversitySandbox
- **RPC**: `rpc SetupUniversitySandbox(exa.language_server_pb.SetupUniversitySandboxRequest) returns (exa.language_server_pb.SetupUniversitySandboxResponse);`
- **Description**: 教育・チュートリアル用のサンドボックス環境をセットアップする。

### Exit
- **RPC**: `rpc Exit(exa.language_server_pb.ExitRequest) returns (exa.language_server_pb.ExitResponse);`
- **Description**: Language Serverプロセスを終了する。

### Restart
- **RPC**: `rpc Restart(exa.language_server_pb.RestartRequest) returns (exa.language_server_pb.RestartResponse);`
- **Description**: Language Serverプロセスを再起動する。

### ResetOnboarding
- **RPC**: `rpc ResetOnboarding(exa.language_server_pb.ResetOnboardingRequest) returns (exa.language_server_pb.ResetOnboardingResponse);`
- **Description**: オンボーディング手順（初期ツアー）を未完了状態にリセットする。

### SkipOnboarding
- **RPC**: `rpc SkipOnboarding(exa.language_server_pb.SkipOnboardingRequest) returns (exa.language_server_pb.SkipOnboardingResponse);`
- **Description**: オンボーディング手順をスキップする。

### GetTermsOfService
- **RPC**: `rpc GetTermsOfService(exa.language_server_pb.GetTermsOfServiceRequest) returns (exa.language_server_pb.GetTermsOfServiceResponse);`
- **Description**: 利用規約（Terms of Service）のテキストを取得する。

### AcceptTermsOfService
- **RPC**: `rpc AcceptTermsOfService(exa.language_server_pb.AcceptTermsOfServiceRequest) returns (exa.language_server_pb.AcceptTermsOfServiceResponse);`
- **Description**: 利用規約への同意結果を登録する。

### GetUserTrajectoryDebug
- **RPC**: `rpc GetUserTrajectoryDebug(exa.language_server_pb.GetUserTrajectoryDebugRequest) returns (exa.language_server_pb.GetUserTrajectoryDebugResponse);`
- **Description**: エージェント軌跡（Trajectory）のデバッグ情報を取得する。

### GetUserTrajectoryDescriptions
- **RPC**: `rpc GetUserTrajectoryDescriptions(exa.language_server_pb.GetUserTrajectoryDescriptionsRequest) returns (exa.language_server_pb.GetUserTrajectoryDescriptionsResponse);`
- **Description**: 過去に実行されたエージェント軌跡の説明リストを取得する。

### StreamUserTrajectoryReactiveUpdates
- **RPC**: `rpc StreamUserTrajectoryReactiveUpdates(exa.reactive_component_pb.StreamReactiveUpdatesRequest) returns (stream exa.reactive_component_pb.StreamReactiveUpdatesResponse);`
- **Description**: エージェントの軌跡状態のリアルタイム更新情報をストリーミングで監視する。

### GetCascadeMemories
- **RPC**: `rpc GetCascadeMemories(exa.language_server_pb.GetCascadeMemoriesRequest) returns (exa.language_server_pb.GetCascadeMemoriesResponse);`
- **Description**: Cascadeエージェントが保持しているメモリ（記憶）一覧を取得する。

### DeleteCascadeMemory
- **RPC**: `rpc DeleteCascadeMemory(exa.language_server_pb.DeleteCascadeMemoryRequest) returns (exa.language_server_pb.DeleteCascadeMemoryResponse);`
- **Description**: Cascadeエージェントの特定のメモリを削除する。

### UpdateCascadeMemory
- **RPC**: `rpc UpdateCascadeMemory(exa.language_server_pb.UpdateCascadeMemoryRequest) returns (exa.language_server_pb.UpdateCascadeMemoryResponse);`
- **Description**: Cascadeエージェントの特定のメモリ内容を更新する.

### GetUserMemories
- **RPC**: `rpc GetUserMemories(exa.language_server_pb.GetUserMemoriesRequest) returns (exa.language_server_pb.GetUserMemoriesResponse);`
- **Description**: ユーザーごとのパーソナライズ用長期メモリ情報を取得する。

### UpdateConversationAnnotations
- **RPC**: `rpc UpdateConversationAnnotations(exa.language_server_pb.UpdateConversationAnnotationsRequest) returns (exa.language_server_pb.UpdateConversationAnnotationsResponse);`
- **Description**: 対話スレッドに対する注釈やメタデータを更新する。

### StartCascade
- **RPC**: `rpc StartCascade(exa.language_server_pb.StartCascadeRequest) returns (exa.language_server_pb.StartCascadeResponse);`
- **Description**: 新規にCascadeエージェントの対話セッションを開始する。

### GetSlashCommands
- **RPC**: `rpc GetSlashCommands(exa.language_server_pb.GetSlashCommandsRequest) returns (exa.language_server_pb.GetSlashCommandsResponse);`
- **Description**: 使用可能なスラッシュコマンドの一覧を取得する。

### StartBattleMode
- **RPC**: `rpc StartBattleMode(exa.language_server_pb.StartBattleModeRequest) returns (exa.language_server_pb.StartBattleModeResponse);`
- **Description**: 複数モデルを競争させ評価を行うバトルモードを起動する。

### EndBattleMode
- **RPC**: `rpc EndBattleMode(exa.language_server_pb.EndBattleModeRequest) returns (exa.language_server_pb.EndBattleModeResponse);`
- **Description**: バトルモードを終了し、得られた結果をマージする。

### SetOrVerifyStaticConfig
- **RPC**: `rpc SetOrVerifyStaticConfig(exa.language_server_pb.SetOrVerifyStaticConfigRequest) returns (exa.language_server_pb.SetOrVerifyStaticConfigResponse);`
- **Description**: 静的なサーバー設定の適用・検証を行う。

### ForkConversation
- **RPC**: `rpc ForkConversation(exa.language_server_pb.ForkConversationRequest) returns (exa.language_server_pb.ForkConversationResponse);`
- **Description**: 既存の対話セッションを任意のステップで複製し、別のスレッドとして派生させる。

### CancelCascadeInvocation
- **RPC**: `rpc CancelCascadeInvocation(exa.language_server_pb.CancelCascadeInvocationRequest) returns (exa.language_server_pb.CancelCascadeInvocationResponse);`
- **Description**: 実行中のエージェント推論タスクを中断・キャンセルする。

### ForceStopCascadeTree
- **RPC**: `rpc ForceStopCascadeTree(exa.language_server_pb.ForceStopCascadeTreeRequest) returns (exa.language_server_pb.ForceStopCascadeTreeResponse);`
- **Description**: エージェントタスクのツリー全体を強制停止する。

### CancelCascadeSteps
- **RPC**: `rpc CancelCascadeSteps(exa.language_server_pb.CancelCascadeStepsRequest) returns (exa.language_server_pb.CancelCascadeStepsResponse);`
- **Description**: 計画されたタスクステップの一部をキャンセルする。

### SendStepsToBackground
- **RPC**: `rpc SendStepsToBackground(exa.language_server_pb.SendStepsToBackgroundRequest) returns (exa.language_server_pb.SendStepsToBackgroundResponse);`
- **Description**: 指定されたステップを非同期のバックグラウンドタスクとして実行へ回す。

### SkipBrowserSubagent
- **RPC**: `rpc SkipBrowserSubagent(exa.language_server_pb.SkipBrowserSubagentRequest) returns (exa.language_server_pb.SkipBrowserSubagentResponse);`
- **Description**: 実行中のブラウザ自動操作エージェント（Subagent）の処理をスキップする。

### GetCascadeModelConfigData
- **RPC**: `rpc GetCascadeModelConfigData(exa.language_server_pb.GetCascadeModelConfigDataRequest) returns (exa.codeium_common_pb.CascadeModelConfigData);`
- **Description**: 指定モデルに対応するCascade構成パラメーターを取得する。

### SendUserCascadeMessage
- **RPC**: `rpc SendUserCascadeMessage(exa.language_server_pb.SendUserCascadeMessageRequest) returns (exa.language_server_pb.SendUserCascadeMessageResponse);`
- **Description**: Cascade対話セッションにユーザーからの新規メッセージを送信する。

### SignalExecutableIdle
- **RPC**: `rpc SignalExecutableIdle(exa.language_server_pb.SignalExecutableIdleRequest) returns (exa.language_server_pb.SignalExecutableIdleResponse);`
- **Description**: 外部の実行可能プロセスがアイドル状態になったことをエージェントに通知する。

### WaitForConversationFullyIdle
- **RPC**: `rpc WaitForConversationFullyIdle(exa.language_server_pb.WaitForConversationFullyIdleRequest) returns (exa.language_server_pb.WaitForConversationFullyIdleResponse);`
- **Description**: 対話セッションに関わるすべてのバックグラウンドタスクや推論が完全にアイドルになるまで同期的に待機する。

### SendAllQueuedMessages
- **RPC**: `rpc SendAllQueuedMessages(exa.language_server_pb.SendAllQueuedMessagesRequest) returns (exa.language_server_pb.SendAllQueuedMessagesResponse);`
- **Description**: キューにたまっているメッセージをすべて処理へ送る。

### DeleteQueuedUserInputStep
- **RPC**: `rpc DeleteQueuedUserInputStep(exa.language_server_pb.DeleteQueuedUserInputStepRequest) returns (exa.language_server_pb.DeleteQueuedUserInputStepResponse);`
- **Description**: 待機列（キュー）にあるユーザー入力ステップを削除する。

### RevertToCascadeStep
- **RPC**: `rpc RevertToCascadeStep(exa.language_server_pb.RevertToCascadeStepRequest) returns (exa.language_server_pb.RevertToCascadeStepResponse);`
- **Description**: 指定したステップ（インデックス）時点の状態までファイル変更とコンテキスト履歴をロールバックする。

### GetRevertPreview
- **RPC**: `rpc GetRevertPreview(exa.language_server_pb.GetRevertPreviewRequest) returns (exa.language_server_pb.GetRevertPreviewResponse);`
- **Description**: ロールバック（Revert）を実行した場合に生じるファイルの変更差分プレビューを取得する。

### RecordUserStepSnapshot
- **RPC**: `rpc RecordUserStepSnapshot(exa.language_server_pb.RecordUserStepSnapshotRequest) returns (exa.language_server_pb.RecordUserStepSnapshotResponse);`
- **Description**: ロールバックなどの復元先となるスナップショットを記録する。

### GetAllCascadeTrajectories
- **RPC**: `rpc GetAllCascadeTrajectories(exa.language_server_pb.GetAllCascadeTrajectoriesRequest) returns (exa.language_server_pb.GetAllCascadeTrajectoriesResponse);`
- **Description**: これまでに実行されたCascadeエージェントの軌跡（Trajectory）の一覧を取得する。

### HandleCascadeUserInteraction
- **RPC**: `rpc HandleCascadeUserInteraction(exa.language_server_pb.HandleCascadeUserInteractionRequest) returns (exa.language_server_pb.HandleCascadeUserInteractionResponse);`
- **Description**: エージェント実行中に発生したユーザー向けインタラクションを処理する。

### AcknowledgeCascadeCodeEdit
- **RPC**: `rpc AcknowledgeCascadeCodeEdit(exa.language_server_pb.AcknowledgeCascadeCodeEditRequest) returns (exa.language_server_pb.AcknowledgeCascadeCodeEditResponse);`
- **Description**: 生成されたコード編集変更（差分）に対する確定（Accept）または破棄（Reject）をサーバーに通知する。

### AcknowledgeCodeActionStep
- **RPC**: `rpc AcknowledgeCodeActionStep(exa.language_server_pb.AcknowledgeCodeActionStepRequest) returns (exa.language_server_pb.AcknowledgeCodeActionStepResponse);`
- **Description**: 複数ファイルの編集を伴うコードアクションステップ全体の確定または破棄を通知する。

### GetCodeValidationStates
- **RPC**: `rpc GetCodeValidationStates(exa.language_server_pb.GetCodeValidationStatesRequest) returns (exa.language_server_pb.GetCodeValidationStatesResponse);`
- **Description**: コードの検証ステータスを取得する。

### DeleteCascadeTrajectory
- **RPC**: `rpc DeleteCascadeTrajectory(exa.language_server_pb.DeleteCascadeTrajectoryRequest) returns (exa.language_server_pb.DeleteCascadeTrajectoryResponse);`
- **Description**: 保存されている特定の対話・実行軌跡履歴を削除する。

### GetConversationMetadata
- **RPC**: `rpc GetConversationMetadata(exa.language_server_pb.GetConversationMetadataRequest) returns (exa.language_server_pb.GetConversationMetadataResponse);`
- **Description**: 対話セッションのメタデータ（タイトル、作成日時、関連リポジトリ等）を取得する。

### GetTurnDiff
- **RPC**: `rpc GetTurnDiff(exa.language_server_pb.GetTurnDiffRequest) returns (exa.language_server_pb.GetTurnDiffResponse);`
- **Description**: 指定した対話ターンのステップで発生したファイル変更差分を取得する。

### InitializeCascadePanelState
- **RPC**: `rpc InitializeCascadePanelState(exa.language_server_pb.InitializeCascadePanelStateRequest) returns (exa.language_server_pb.InitializeCascadePanelStateResponse);`
- **Description**: UIのチャットパネルやCascade操作用ダッシュボードの表示状態を初期化する。

### StreamCascadePanelReactiveUpdates
- **RPC**: `rpc StreamCascadePanelReactiveUpdates(exa.reactive_component_pb.StreamReactiveUpdatesRequest) returns (stream exa.reactive_component_pb.StreamReactiveUpdatesResponse);`
- **Description**: UIパネル上のコンポーネント更新をリアクティブに受信するストリーミング。

### StreamCascadeReactiveUpdates
- **RPC**: `rpc StreamCascadeReactiveUpdates(exa.reactive_component_pb.StreamReactiveUpdatesRequest) returns (stream exa.reactive_component_pb.StreamReactiveUpdatesResponse);`
- **Description**: Cascadeエージェント全体の実行状態更新をリアクティブに受信するストリーミング。

### StreamCascadeSummariesReactiveUpdates
- **RPC**: `rpc StreamCascadeSummariesReactiveUpdates(exa.reactive_component_pb.StreamReactiveUpdatesRequest) returns (stream exa.reactive_component_pb.StreamReactiveUpdatesResponse);`
- **Description**: エージェント実行結果のサマリーの更新を受信するストリーミング。

### StreamAgentStateUpdates
- **RPC**: `rpc StreamAgentStateUpdates(exa.jetski_cortex_pb.StreamAgentStateUpdatesRequest) returns (stream exa.jetski_cortex_pb.StreamAgentStateUpdatesResponse);`
- **Description**: エージェントの内部状態遷移をリアルタイム受信するストリーミング。

### RequestAgentStatePageUpdate
- **RPC**: `rpc RequestAgentStatePageUpdate(exa.jetski_cortex_pb.AgentStatePageUpdateRequest) returns (exa.jetski_cortex_pb.AgentStatePageUpdateResponse);`
- **Description**: エージェントの状態表示UIページの更新を明示的に要求する。

### ForceBackgroundResearchRefresh
- **RPC**: `rpc ForceBackgroundResearchRefresh(exa.language_server_pb.ForceBackgroundResearchRefreshRequest) returns (exa.language_server_pb.ForceBackgroundResearchRefreshResponse);`
- **Description**: バックグラウンドで実行されている調査（Research）処理を強制的にリフレッシュする。

### ResolveOutstandingSteps
- **RPC**: `rpc ResolveOutstandingSteps(exa.language_server_pb.ResolveOutstandingStepsRequest) returns (exa.language_server_pb.ResolveOutstandingStepsResponse);`
- **Description**: 未完了のまま残っているステップを一括解決・クリーンアップする。

### RefreshMcpServers
- **RPC**: `rpc RefreshMcpServers(exa.language_server_pb.RefreshMcpServersRequest) returns (exa.language_server_pb.RefreshMcpServersResponse);`
- **Description**: 接続されているMCPサーバーの状態と利用可能ツールを再検出・更新する。

### ToggleMcpServer
- **RPC**: `rpc ToggleMcpServer(exa.language_server_pb.ToggleMcpServerRequest) returns (exa.language_server_pb.ToggleMcpServerResponse);`
- **Description**: 特定のMCPサーバーの有効・無効を切り替える。

### GetMcpServerStates
- **RPC**: `rpc GetMcpServerStates(exa.language_server_pb.GetMcpServerStatesRequest) returns (exa.language_server_pb.GetMcpServerStatesResponse);`
- **Description**: すべてのMCPサーバーの有効化状態や利用可能なツールリストを取得する。

### CompleteMcpOAuth
- **RPC**: `rpc CompleteMcpOAuth(exa.language_server_pb.CompleteMcpOAuthRequest) returns (exa.language_server_pb.CompleteMcpOAuthResponse);`
- **Description**: MCPサーバーが求めるOAuth認証フローを完了させる。

### DisconnectMcpOAuth
- **RPC**: `rpc DisconnectMcpOAuth(exa.language_server_pb.DisconnectMcpOAuthRequest) returns (exa.language_server_pb.DisconnectMcpOAuthResponse);`
- **Description**: MCPサーバーのOAuth接続を解除する。

### StreamTerminalShellCommand
- **RPC**: `rpc StreamTerminalShellCommand(stream exa.codeium_common_pb.TerminalShellCommandStreamChunk) returns (exa.language_server_pb.StreamTerminalShellCommandResponse);`
- **Description**: 端末コマンド（シェルコマンド）の実行と入出力を双方向ストリーミングで行う。

### GetModelResponse
- **RPC**: `rpc GetModelResponse(exa.language_server_pb.GetModelResponseRequest) returns (exa.language_server_pb.GetModelResponseResponse);`
- **Description**: 言語モデルに対してのダイレクトな推論リクエストを投げて応答を得る。

### SaveMediaAsArtifact
- **RPC**: `rpc SaveMediaAsArtifact(exa.language_server_pb.SaveMediaAsArtifactRequest) returns (exa.language_server_pb.SaveMediaAsArtifactResponse);`
- **Description**: メディアファイルをセッションの成果物（Artifact）として保存する。

### DeleteMediaArtifact
- **RPC**: `rpc DeleteMediaArtifact(exa.language_server_pb.DeleteMediaArtifactRequest) returns (exa.language_server_pb.DeleteMediaArtifactResponse);`
- **Description**: 保存されている特定のメディア成果物を削除する。

### GetWebDocsOptions
- **RPC**: `rpc GetWebDocsOptions(exa.language_server_pb.GetWebDocsOptionsRequest) returns (exa.language_server_pb.GetWebDocsOptionsResponse);`
- **Description**: Webドキュメント検索や取得に関する設定オプションを取得する。

### UpdateDevExperiments
- **RPC**: `rpc UpdateDevExperiments(exa.language_server_pb.UpdateDevExperimentsRequest) returns (exa.language_server_pb.UpdateDevExperimentsResponse);`
- **Description**: 開発環境向けにテスト中の機能を強制的に有効化・更新する。

### SetBaseExperiments
- **RPC**: `rpc SetBaseExperiments(exa.language_server_pb.SetBaseExperimentsRequest) returns (exa.language_server_pb.SetBaseExperimentsResponse);`
- **Description**: ベースとなる機能トグル（Experiments）の状態を書き込む。

### GetUnleashData
- **RPC**: `rpc GetUnleashData(exa.language_server_pb.GetUnleashDataRequest) returns (exa.language_server_pb.GetUnleashDataResponse);`
- **Description**: Unleash機能トグル配信システムから全データをフェッチする。

### GetMendelFlags
- **RPC**: `rpc GetMendelFlags(exa.language_server_pb.GetMendelFlagsRequest) returns (exa.language_server_pb.GetMendelFlagsResponse);`
- **Description**: Mendelと呼ばれるA/Bテスト・設定配信のフラグ情報を取得する。

### GetModelStatuses
- **RPC**: `rpc GetModelStatuses(exa.language_server_pb.GetModelStatusesRequest) returns (exa.language_server_pb.GetModelStatusesResponse);`
- **Description**: 利用可能な各言語モデルの稼働・接続ステータスを取得する。

### GetAllWorkflows
- **RPC**: `rpc GetAllWorkflows(exa.language_server_pb.GetAllWorkflowsRequest) returns (exa.language_server_pb.GetAllWorkflowsResponse);`
- **Description**: 登録されているエージェント用のワークフロー設定をすべて取得する。

### GetAllCustomAgentConfigs
- **RPC**: `rpc GetAllCustomAgentConfigs(exa.language_server_pb.GetAllCustomAgentConfigsRequest) returns (exa.language_server_pb.GetAllCustomAgentConfigsResponse);`
- **Description**: 独自に定義されたカスタムエージェント構成をすべて取得する。

### CopyBuiltinWorkflowToWorkspace
- **RPC**: `rpc CopyBuiltinWorkflowToWorkspace(exa.language_server_pb.CopyBuiltinWorkflowToWorkspaceRequest) returns (exa.language_server_pb.CopyBuiltinWorkflowToWorkspaceResponse);`
- **Description**: 組み込み済みのビルトインワークフロー定義を現在のワークスペースへコピーする。

### GetAllRules
- **RPC**: `rpc GetAllRules(exa.language_server_pb.GetAllRulesRequest) returns (exa.language_server_pb.GetAllRulesResponse);`
- **Description**: 適用されるカスタムコーディングルールを取得する。

### GetAllSkills
- **RPC**: `rpc GetAllSkills(exa.language_server_pb.GetAllSkillsRequest) returns (exa.language_server_pb.GetAllSkillsResponse);`
- **Description**: 登録されているエージェントスキルをすべて取得する。

### GetSkillMarketplaceLink
- **RPC**: `rpc GetSkillMarketplaceLink(exa.language_server_pb.GetSkillMarketplaceLinkRequest) returns (exa.language_server_pb.GetSkillMarketplaceLinkResponse);`
- **Description**: 追加のスキルを導入するためのマーケットプレイスへのURLを取得する。

### GenerateSkillInstallationCL
- **RPC**: `rpc GenerateSkillInstallationCL(exa.language_server_pb.GenerateSkillInstallationCLRequest) returns (exa.language_server_pb.GenerateSkillInstallationCLResponse);`
- **Description**: スキルのインストールに必要なチェンジリスト（CL）あるいはコード変更を自動生成する。

### ScanSkillsConfigFile
- **RPC**: `rpc ScanSkillsConfigFile(exa.language_server_pb.ScanSkillsConfigFileRequest) returns (exa.language_server_pb.ScanSkillsConfigFileResponse);`
- **Description**: 指定されたスキルの設定ファイルを解析する。

### ListMcpResources
- **RPC**: `rpc ListMcpResources(exa.language_server_pb.ListMcpResourcesRequest) returns (exa.language_server_pb.ListMcpResourcesResponse);`
- **Description**: 各種MCPサーバーが公開しているリソースを一覧取得する。

### ListMcpPrompts
- **RPC**: `rpc ListMcpPrompts(exa.language_server_pb.ListMcpPromptsRequest) returns (exa.language_server_pb.ListMcpPromptsResponse);`
- **Description**: MCPサーバーが提供する再利用可能なプロンプトのテンプレート一覧を取得する。

### GetMcpPrompt
- **RPC**: `rpc GetMcpPrompt(exa.language_server_pb.GetMcpPromptRequest) returns (exa.language_server_pb.GetMcpPromptResponse);`
- **Description**: 特定のMCPプロンプトテンプレートの定義や変数を取得する。

### UpdateEnterpriseExperimentsFromUrl
- **RPC**: `rpc UpdateEnterpriseExperimentsFromUrl(exa.language_server_pb.UpdateEnterpriseExperimentsFromUrlRequest) returns (exa.language_server_pb.UpdateEnterpriseExperimentsFromUrlResponse);`
- **Description**: 外部のエンタープライズ用構成URLから機能テストのフラグをダウンロードして適用する。

### ImportFromCursor
- **RPC**: `rpc ImportFromCursor(exa.language_server_pb.ImportFromCursorRequest) returns (exa.language_server_pb.ImportFromCursorResponse);`
- **Description**: Cursorなどの他エディタでの設定や履歴、コンテキスト情報をインポートする。

### CreateCustomizationFile
- **RPC**: `rpc CreateCustomizationFile(exa.language_server_pb.CreateCustomizationFileRequest) returns (exa.language_server_pb.CreateCustomizationFileResponse);`
- **Description**: ワークフロー、ルール、スキル定義用のカスタマイズファイルを新規作成する。

### ListCustomizationPathsByFile
- **RPC**: `rpc ListCustomizationPathsByFile(exa.language_server_pb.ListCustomizationPathsByFileRequest) returns (exa.language_server_pb.ListCustomizationPathsByFileResponse);`
- **Description**: 設定ファイルに定義されたカスタム定義の一覧を取得する。

### UpdateCustomizationPathsFile
- **RPC**: `rpc UpdateCustomizationPathsFile(exa.language_server_pb.UpdateCustomizationPathsFileRequest) returns (exa.language_server_pb.UpdateCustomizationPathsFileResponse);`
- **Description**: カスタマイズ設定のパス群情報を追加、削除、あるいは一括更新する。

### GetTeamOrganizationalControls
- **RPC**: `rpc GetTeamOrganizationalControls(exa.language_server_pb.GetTeamOrganizationalControlsRequest) returns (exa.language_server_pb.GetTeamOrganizationalControlsResponse);`
- **Description**: 所属チームレベルでの使用モデル制限や管理設定を取得する。

### RecordUserGrep
- **RPC**: `rpc RecordUserGrep(exa.language_server_pb.RecordUserGrepRequest) returns (exa.language_server_pb.RecordUserGrepResponse);`
- **Description**: ユーザー自身が実行したGrep検索クエリを記録する。

### CreateTrajectoryShare
- **RPC**: `rpc CreateTrajectoryShare(exa.language_server_pb.CreateTrajectoryShareRequest) returns (exa.language_server_pb.CreateTrajectoryShareResponse);`
- **Description**: エージェントの実行軌跡（Trajectory）を他者と共有するためのデータを生成する。

### GetCascadeTrajectory
- **RPC**: `rpc GetCascadeTrajectory(exa.language_server_pb.GetCascadeTrajectoryRequest) returns (exa.language_server_pb.GetCascadeTrajectoryResponse);`
- **Description**: 指定されたセッションIDのCascade実行軌跡を取得する。

### GetArtifactSnapshots
- **RPC**: `rpc GetArtifactSnapshots(exa.language_server_pb.GetArtifactSnapshotsRequest) returns (exa.language_server_pb.GetArtifactSnapshotsResponse);`
- **Description**: 成果物（Artifact）の履歴・スナップショット一覧を取得する。

### GetUserTrajectory
- **RPC**: `rpc GetUserTrajectory(exa.language_server_pb.GetUserTrajectoryRequest) returns (exa.language_server_pb.GetUserTrajectoryResponse);`
- **Description**: ユーザーセッション全体の軌跡ログを取得する。

### GetCascadeTrajectorySteps
- **RPC**: `rpc GetCascadeTrajectorySteps(exa.language_server_pb.GetCascadeTrajectoryStepsRequest) returns (exa.language_server_pb.GetCascadeTrajectoryStepsResponse);`
- **Description**: 指定軌跡に含まれる実行ステップ群の詳細情報を取得する。

### GetCascadeTrajectoryGeneratorMetadata
- **RPC**: `rpc GetCascadeTrajectoryGeneratorMetadata(exa.language_server_pb.GetCascadeTrajectoryGeneratorMetadataRequest) returns (exa.language_server_pb.GetCascadeTrajectoryGeneratorMetadataResponse);`
- **Description**: 実行軌跡を生成したエンジン側のメタデータを取得する。

### GetCascadeTrajectoryExecutorMetadatas
- **RPC**: `rpc GetCascadeTrajectoryExecutorMetadatas(exa.language_server_pb.GetCascadeTrajectoryExecutorMetadatasRequest) returns (exa.language_server_pb.GetCascadeTrajectoryExecutorMetadatasResponse);`
- **Description**: 軌跡に沿って処理を実行したExecutor側のメタデータを取得する。

### GetPatchAndCodeChange
- **RPC**: `rpc GetPatchAndCodeChange(exa.language_server_pb.GetPatchAndCodeChangeRequest) returns (exa.language_server_pb.GetPatchAndCodeChangeResponse);`
- **Description**: 指定した変更の具体的なパッチ記述と編集内容を取得する。

### ConvertTrajectoryToMarkdown
- **RPC**: `rpc ConvertTrajectoryToMarkdown(exa.language_server_pb.ConvertTrajectoryToMarkdownRequest) returns (exa.language_server_pb.ConvertTrajectoryToMarkdownResponse);`
- **Description**: エージェントの行動履歴（Trajectory）をMarkdown形式のテキストに変換する。

### LoadTrajectory
- **RPC**: `rpc LoadTrajectory(exa.language_server_pb.LoadTrajectoryRequest) returns (exa.language_server_pb.LoadTrajectoryResponse);`
- **Description**: 過去の軌跡データを復元のためにLanguage Serverへ読み込む。

### ImportProjectFromUrl
- **RPC**: `rpc ImportProjectFromUrl(exa.language_server_pb.ImportProjectFromUrlRequest) returns (exa.language_server_pb.ImportProjectFromUrlResponse);`
- **Description**: 指定URLからプロジェクトをダウンロードしインポートする。

### GetAvailableCascadePlugins
- **RPC**: `rpc GetAvailableCascadePlugins(exa.language_server_pb.GetAvailableCascadePluginsRequest) returns (exa.language_server_pb.GetAvailableCascadePluginsResponse);`
- **Description**: インストール可能なCascade用追加プラグインの一覧を取得する。

### InstallCascadePlugin
- **RPC**: `rpc InstallCascadePlugin(exa.language_server_pb.InstallCascadePluginRequest) returns (exa.language_server_pb.InstallCascadePluginResponse);`
- **Description**: 指定したIDの追加プラグインをインストールする。

### GetCascadePluginById
- **RPC**: `rpc GetCascadePluginById(exa.language_server_pb.GetCascadePluginByIdRequest) returns (exa.language_server_pb.GetCascadePluginByIdResponse);`
- **Description**: 特定のプラグインの詳細定義情報を取得する。

### GetAllPlugins
- **RPC**: `rpc GetAllPlugins(exa.language_server_pb.GetAllPluginsRequest) returns (exa.language_server_pb.GetAllPluginsResponse);`
- **Description**: 現在インストールされているプラグインをすべて取得する。

### GetBuildWithGooglePlugins
- **RPC**: `rpc GetBuildWithGooglePlugins(exa.language_server_pb.GetBuildWithGooglePluginsRequest) returns (exa.language_server_pb.GetBuildWithGooglePluginsResponse);`
- **Description**: Build with Googleプログラムで公開されている公式プラグインの一覧を取得する。

### DownloadBuildWithGooglePlugin
- **RPC**: `rpc DownloadBuildWithGooglePlugin(exa.language_server_pb.DownloadBuildWithGooglePluginRequest) returns (exa.language_server_pb.DownloadBuildWithGooglePluginResponse);`
- **Description**: 指定された公式プラグインをダウンロードして有効化する。

### DeletePlugin
- **RPC**: `rpc DeletePlugin(exa.language_server_pb.DeletePluginRequest) returns (exa.language_server_pb.DeletePluginResponse);`
- **Description**: インストール済みのプラグインを削除する。

### UpdateCustomization
- **RPC**: `rpc UpdateCustomization(exa.language_server_pb.UpdateCustomizationRequest) returns (exa.language_server_pb.UpdateCustomizationResponse);`
- **Description**: カスタマイズ設定（ルールやワークフロー）を即時更新する。

### GetAgentScripts
- **RPC**: `rpc GetAgentScripts(exa.language_server_pb.GetAgentScriptsRequest) returns (exa.language_server_pb.GetAgentScriptsResponse);`
- **Description**: エージェント内部で実行可能なスクリプトやツールの一覧を取得する。

### SaveAgentScriptCommandSpec
- **RPC**: `rpc SaveAgentScriptCommandSpec(exa.language_server_pb.SaveAgentScriptCommandSpecRequest) returns (exa.language_server_pb.SaveAgentScriptCommandSpecResponse);`
- **Description**: エージェントスクリプトのコマンド呼び出し仕様を保存する。

### RecordLints
- **RPC**: `rpc RecordLints(exa.language_server_pb.RecordLintsRequest) returns (exa.language_server_pb.RecordLintsResponse);`
- **Description**: 静的解析（Linter）のエラーや警告情報を記録する。

### ReplayGroundTruthTrajectory
- **RPC**: `rpc ReplayGroundTruthTrajectory(exa.language_server_pb.ReplayGroundTruthTrajectoryRequest) returns (exa.language_server_pb.ReplayGroundTruthTrajectoryResponse);`
- **Description**: 正解データの軌跡に基づき自動で動作を再現する。

### LoadReplayConversation
- **RPC**: `rpc LoadReplayConversation(exa.language_server_pb.LoadReplayConversationRequest) returns (exa.language_server_pb.LoadReplayConversationResponse);`
- **Description**: 再現再生用の対話セッションを初期ロードする。

### RecordInteractiveCascadeFeedback
- **RPC**: `rpc RecordInteractiveCascadeFeedback(exa.language_server_pb.RecordInteractiveCascadeFeedbackRequest) returns (exa.language_server_pb.RecordInteractiveCascadeFeedbackResponse);`
- **Description**: 対話的に動作するCascadeのターンで送信された詳細なユーザー評価データを記録する。

### GetCascadeNuxes
- **RPC**: `rpc GetCascadeNuxes(exa.language_server_pb.GetCascadeNuxesRequest) returns (exa.language_server_pb.GetCascadeNuxesResponse);`
- **Description**: 新規ユーザー体験（NUX）のガイド進捗状態を取得する。

### RegisterInteraction
- **RPC**: `rpc RegisterInteraction(exa.language_server_pb.RegisterInteractionRequest) returns (exa.language_server_pb.RegisterInteractionResponse);`
- **Description**: ユーザーとシステムの特定のアクションやインタラクション実績を記録する。

### GetTranscription
- **RPC**: `rpc GetTranscription(exa.language_server_pb.GetTranscriptionRequest) returns (exa.language_server_pb.GetTranscriptionResponse);`
- **Description**: 送信された音声データからテキスト書き起こし結果を取得する。

### StreamAudioTranscription
- **RPC**: `rpc StreamAudioTranscription(exa.language_server_pb.StartAudioTranscriptionRequest) returns (stream exa.language_server_pb.StreamAudioTranscriptionResponse);`
- **Description**: 音声入力をリアルタイムでストリーミングして書き起こし結果を受信する。

### SendAudioChunk
- **RPC**: `rpc SendAudioChunk(exa.language_server_pb.SendAudioChunkRequest) returns (exa.language_server_pb.SendAudioChunkResponse);`
- **Description**: ストリーミング音声書き起こしセッションに対して、音声のバイナリチャンクを順次送信する。

### EndAudioSession
- **RPC**: `rpc EndAudioSession(exa.language_server_pb.EndAudioSessionRequest) returns (exa.language_server_pb.EndAudioSessionResponse);`
- **Description**: 音声入力の送信終了を通知する。

### GetStaticExperimentStatus
- **RPC**: `rpc GetStaticExperimentStatus(exa.language_server_pb.GetStaticExperimentStatusRequest) returns (exa.language_server_pb.GetStaticExperimentStatusResponse);`
- **Description**: 静的に組み込まれたテスト・機能トグルの状態を確認する。

### RecordAnalyticsEvent
- **RPC**: `rpc RecordAnalyticsEvent(exa.language_server_pb.RecordAnalyticsEventRequest) returns (exa.language_server_pb.RecordAnalyticsEventResponse);`
- **Description**: アナリティクス用の詳細な製品イベントを記録する。

### RecordError
- **RPC**: `rpc RecordError(exa.language_server_pb.RecordErrorRequest) returns (exa.language_server_pb.RecordErrorResponse);`
- **Description**: システム内で発生した例外・エラー内容を記録する。

### RecordObservabilityData
- **RPC**: `rpc RecordObservabilityData(exa.language_server_pb.RecordObservabilityDataRequest) returns (exa.language_server_pb.RecordObservabilityDataResponse);`
- **Description**: システム可観測性のためのテレメトリ情報を記録する。

### ListPages
- **RPC**: `rpc ListPages(exa.language_server_pb.ListPagesRequest) returns (exa.language_server_pb.ListPagesResponse);`
- **Description**: ブラウザ自動操作エージェントが現在開いているブラウザタブの一覧を取得する。

### BrowserValidateCascadeOrCancelOverlay
- **RPC**: `rpc BrowserValidateCascadeOrCancelOverlay(exa.language_server_pb.BrowserValidateCascadeOrCancelOverlayRequest) returns (exa.language_server_pb.BrowserValidateCascadeOrCancelOverlayResponse);`
- **Description**: ブラウザ操作のオーバーレイ検証、またはオーバーレイのキャンセルを行う。

### OpenUrl
- **RPC**: `rpc OpenUrl(exa.language_server_pb.OpenUrlRequest) returns (exa.language_server_pb.OpenUrlResponse);`
- **Description**: ブラウザ上で指定のURLを開く。

### FocusUserPage
- **RPC**: `rpc FocusUserPage(exa.language_server_pb.FocusUserPageRequest) returns (exa.language_server_pb.FocusUserPageResponse);`
- **Description**: 開かれているブラウザタブのうち、指定のターゲットにフォーカスを当てる。

### AddToBrowserWhitelist
- **RPC**: `rpc AddToBrowserWhitelist(exa.language_server_pb.AddToBrowserWhitelistRequest) returns (exa.language_server_pb.AddToBrowserWhitelistResponse);`
- **Description**: ブラウザでのアクセスを許可するホワイトリストにURLドメインを追加する。

### CaptureConsoleLogs
- **RPC**: `rpc CaptureConsoleLogs(exa.language_server_pb.CaptureConsoleLogsRequest) returns (exa.language_server_pb.CaptureConsoleLogsResponse);`
- **Description**: ブラウザのJavaScriptコンソールログをキャプチャする。

### StartScreenRecording
- **RPC**: `rpc StartScreenRecording(exa.language_server_pb.StartScreenRecordingRequest) returns (exa.language_server_pb.StartScreenRecordingResponse);`
- **Description**: エージェント動作中のブラウザやデスクトップの画面録画を開始する。

### SaveScreenRecording
- **RPC**: `rpc SaveScreenRecording(exa.language_server_pb.SaveScreenRecordingRequest) returns (exa.language_server_pb.SaveScreenRecordingResponse);`
- **Description**: 開始した画面録画データを指定ファイルに保存する。

### GetBrowserWhitelistFilePath
- **RPC**: `rpc GetBrowserWhitelistFilePath(exa.language_server_pb.GetBrowserWhitelistFilePathRequest) returns (exa.language_server_pb.GetBrowserWhitelistFilePathResponse);`
- **Description**: ホワイトリストURLが保存されている設定ファイルのフルパスを取得する。

### HandleScreenRecording
- **RPC**: `rpc HandleScreenRecording(exa.language_server_pb.HandleScreenRecordingRequest) returns (exa.language_server_pb.HandleScreenRecordingResponse);`
- **Description**: 画面録画セッションの後処理や変換タスクを制御する。

### GetAllBrowserWhitelistedUrls
- **RPC**: `rpc GetAllBrowserWhitelistedUrls(exa.language_server_pb.GetAllBrowserWhitelistedUrlsRequest) returns (exa.language_server_pb.GetAllBrowserWhitelistedUrlsResponse);`
- **Description**: ブラウザホワイトリストに登録されている全URLパターンを取得する。

### CaptureScreenshot
- **RPC**: `rpc CaptureScreenshot(exa.language_server_pb.CaptureScreenshotRequest) returns (exa.language_server_pb.CaptureScreenshotResponse);`
- **Description**: ブラウザまたはデスクトップのスクリーンショット画像をキャプチャする。

### SmartOpenBrowser
- **RPC**: `rpc SmartOpenBrowser(exa.language_server_pb.SmartOpenBrowserRequest) returns (exa.language_server_pb.SmartOpenBrowserResponse);`
- **Description**: 新規ブラウザウィンドウを起動する。

### SimulateSegFault
- **RPC**: `rpc SimulateSegFault(exa.language_server_pb.SimulateSegFaultRequest) returns (exa.language_server_pb.SimulateSegFaultResponse);`
- **Description**: Language Serverプロセスを意図的にセグメンテーションフォールトで強制終了させる。

### ReconnectExtensionServer
- **RPC**: `rpc ReconnectExtensionServer(exa.language_server_pb.ReconnectExtensionServerRequest) returns (exa.language_server_pb.ReconnectExtensionServerResponse);`
- **Description**: クライアント拡張機能側のバックエンドサーバーとLanguage Serverの接続を再確立する。

### SetCloudCodeURL
- **RPC**: `rpc SetCloudCodeURL(exa.language_server_pb.SetCloudCodeURLRequest) returns (exa.language_server_pb.SetCloudCodeURLResponse);`
- **Description**: 接続先となるクラウド版Cloud CodeのAPIエンドポイントURLを設定する。

### GetTokenBase
- **RPC**: `rpc GetTokenBase(exa.language_server_pb.GetTokenBaseRequest) returns (exa.language_server_pb.GetTokenBaseResponse);`
- **Description**: API呼び出しや認証に必要なベーストークンを取得する。

### RunCommand
- **RPC**: `rpc RunCommand(exa.language_server_pb.RunCommandRequest) returns (exa.language_server_pb.RunCommandResponse);`
- **Description**: システム上でシェルコマンドを実行し、結果を返す。

### JetboxWriteState
- **RPC**: `rpc JetboxWriteState(exa.language_server_pb.JetboxWriteStateRequest) returns (exa.language_server_pb.JetboxWriteStateResponse);`
- **Description**: Jetbox（隔離開発環境）の状態変数を永続ストアに書き込む。

### JetboxSubscribeToState
- **RPC**: `rpc JetboxSubscribeToState(exa.language_server_pb.JetboxSubscribeToStateRequest) returns (stream exa.language_server_pb.JetboxSubscribeToStateResponse);`
- **Description**: Jetboxの状態変更をストリーミングで受信する。

### JetboxWriteSummary
- **RPC**: `rpc JetboxWriteSummary(exa.language_server_pb.JetboxWriteSummaryRequest) returns (exa.language_server_pb.JetboxWriteSummaryResponse);`
- **Description**: Jetboxの稼働状況などのサマリーを書き込む。

### JetboxDeleteSummary
- **RPC**: `rpc JetboxDeleteSummary(exa.language_server_pb.JetboxDeleteSummaryRequest) returns (exa.language_server_pb.JetboxDeleteSummaryResponse);`
- **Description**: 保存されているJetboxのサマリーデータを削除する。

### JetboxSubscribeToSummaries
- **RPC**: `rpc JetboxSubscribeToSummaries(exa.language_server_pb.JetboxSubscribeToSummariesRequest) returns (stream exa.language_server_pb.JetboxSubscribeToSummariesResponse);`
- **Description**: Jetboxサマリーデータの変更イベントをストリーミング受信する。

### JetboxSubscribeToGcertState
- **RPC**: `rpc JetboxSubscribeToGcertState(exa.language_server_pb.JetboxSubscribeToGcertStateRequest) returns (stream exa.language_server_pb.JetboxSubscribeToGcertStateResponse);`
- **Description**: Google内部認証資格情報（gcert）の有効性ステータスをストリーミング監視する。

### JetboxSubscribeToOAuthState
- **RPC**: `rpc JetboxSubscribeToOAuthState(exa.language_server_pb.JetboxSubscribeToOAuthStateRequest) returns (stream exa.language_server_pb.JetboxSubscribeToOAuthStateResponse);`
- **Description**: JetboxのOAuth接続ステータスの変更をストリーミングで受信する。

### SearchFiles
- **RPC**: `rpc SearchFiles(exa.language_server_pb.SearchFilesRequest) returns (exa.language_server_pb.SearchFilesResponse);`
- **Description**: プロジェクトディレクトリ内のファイルを名前やパスで検索する。

### SearchCode
- **RPC**: `rpc SearchCode(exa.language_server_pb.SearchCodeRequest) returns (exa.language_server_pb.SearchCodeResponse);`
- **Description**: ワークスペース内のソースコード文字列の全文検索を実行する。

### SearchConversations
- **RPC**: `rpc SearchConversations(exa.language_server_pb.SearchConversationsRequest) returns (exa.language_server_pb.SearchConversationsResponse);`
- **Description**: 過去の対話スレッド（チャットログ）の履歴を検索する。

### JetboxGetLatestVersion
- **RPC**: `rpc JetboxGetLatestVersion(exa.language_server_pb.JetboxGetLatestVersionRequest) returns (exa.language_server_pb.JetboxGetLatestVersionResponse);`
- **Description**: Jetboxの利用可能な最新バージョン情報を取得する。

### GetAgentTeamMetadata
- **RPC**: `rpc GetAgentTeamMetadata(exa.language_server_pb.GetAgentTeamMetadataRequest) returns (exa.language_server_pb.GetAgentTeamMetadataResponse);`
- **Description**: 共同開発チームで共有されるエージェントのメタデータ情報を取得する。

### GetCodeFrequencyForRepo
- **RPC**: `rpc GetCodeFrequencyForRepo(exa.language_server_pb.GetCodeFrequencyForRepoRequest) returns (exa.language_server_pb.GetCodeFrequencyForRepoResponse);`
- **Description**: 指定リポジトリのコード変更頻度やアクティビティ推移の統計データを取得する。

### SendAgentMessage
- **RPC**: `rpc SendAgentMessage(exa.language_server_pb.SendAgentMessageRequest) returns (exa.language_server_pb.SendAgentMessageResponse);`
- **Description**: 協調動作している別エージェントに対してメッセージを配信する。

### DeleteAgentMessage
- **RPC**: `rpc DeleteAgentMessage(exa.language_server_pb.DeleteAgentMessageRequest) returns (exa.language_server_pb.DeleteAgentMessageResponse);`
- **Description**: 配信済みのエージェントメッセージを削除する。

### GetLoadCodeAssist
- **RPC**: `rpc GetLoadCodeAssist(exa.language_server_pb.GetLoadCodeAssistRequest) returns (exa.language_server_pb.GetLoadCodeAssistResponse);`
- **Description**: コード支援機能の起動に必要な設定などをロードする。

### GetAvailableModels
- **RPC**: `rpc GetAvailableModels(exa.language_server_pb.GetAvailableModelsRequest) returns (exa.language_server_pb.GetAvailableModelsResponse);`
- **Description**: クライアントが使用可能な推論モデルのリストを取得する。

### CreateProject
- **RPC**: `rpc CreateProject(exa.language_server_pb.CreateProjectRequest) returns (exa.language_server_pb.CreateProjectResponse);`
- **Description**: 新しいプロジェクトをサーバー上に作成する。

### UpdateProject
- **RPC**: `rpc UpdateProject(exa.language_server_pb.UpdateProjectRequest) returns (exa.language_server_pb.UpdateProjectResponse);`
- **Description**: プロジェクトの構成を更新する。

### DeleteProject
- **RPC**: `rpc DeleteProject(exa.language_server_pb.DeleteProjectRequest) returns (exa.language_server_pb.DeleteProjectResponse);`
- **Description**: 指定したプロジェクトを削除する。

### GenerateEnvironmentName
- **RPC**: `rpc GenerateEnvironmentName(exa.language_server_pb.GenerateEnvironmentNameRequest) returns (exa.language_server_pb.GenerateEnvironmentNameResponse);`
- **Description**: 新規環境用に自動生成された一意な環境識別名を取得する。

### AddEnvironmentToProject
- **RPC**: `rpc AddEnvironmentToProject(exa.language_server_pb.AddEnvironmentToProjectRequest) returns (exa.language_server_pb.AddEnvironmentToProjectResponse);`
- **Description**: 作成されたプロジェクトに対して新たな実行環境を追加する。

### ResolveFolder
- **RPC**: `rpc ResolveFolder(exa.language_server_pb.ResolveFolderRequest) returns (exa.language_server_pb.ResolveFolderResponse);`
- **Description**: 指定されたディレクトリ名やURIから、プロジェクトに関連する絶対パスを解決する。

### ProjectUpdatesStream
- **RPC**: `rpc ProjectUpdatesStream(exa.language_server_pb.ProjectUpdatesStreamRequest) returns (stream exa.language_server_pb.ProjectUpdatesStreamResponse);`
- **Description**: プロジェクト設定や構成の更新をストリーミングで監視する。

### ReadProject
- **RPC**: `rpc ReadProject(exa.language_server_pb.ReadProjectRequest) returns (exa.language_server_pb.ReadProjectResponse);`
- **Description**: プロジェクトの詳細設定や関連するリソース構成情報を取得する。

### GetDefaultProjectDir
- **RPC**: `rpc GetDefaultProjectDir(exa.language_server_pb.GetDefaultProjectDirRequest) returns (exa.language_server_pb.GetDefaultProjectDirResponse);`
- **Description**: 新規プロジェクトがデフォルトで作成される親ディレクトリパスを取得する。

### GetAuthStatus
- **RPC**: `rpc GetAuthStatus(exa.language_server_pb.GetAuthStatusRequest) returns (exa.language_server_pb.GetAuthStatusResponse);`
- **Description**: 現在の認証状況を取得する。

### LoginWithBrowser
- **RPC**: `rpc LoginWithBrowser(exa.language_server_pb.LoginWithBrowserRequest) returns (exa.language_server_pb.LoginWithBrowserResponse);`
- **Description**: ウェブブラウザを立ち上げてOAuthログイン認証を実行する。

### AuthLogout
- **RPC**: `rpc AuthLogout(exa.language_server_pb.AuthLogoutRequest) returns (exa.language_server_pb.AuthLogoutResponse);`
- **Description**: サインイン資格情報を破棄してログアウト処理を行う。

### HasAuthToken
- **RPC**: `rpc HasAuthToken(exa.language_server_pb.HasAuthTokenRequest) returns (exa.language_server_pb.HasAuthTokenResponse);`
- **Description**: 有効な認証トークンを保持しているかどうかを判定する。

### ValidateProject
- **RPC**: `rpc ValidateProject(exa.language_server_pb.ValidateProjectRequest) returns (exa.language_server_pb.ValidateProjectResponse);`
- **Description**: プロジェクトの設定や接続先リポジトリが現在有効であるか検証する。

### GetGrantedScopes
- **RPC**: `rpc GetGrantedScopes(exa.language_server_pb.GetGrantedScopesRequest) returns (exa.language_server_pb.GetGrantedScopesResponse);`
- **Description**: 現在の認証資格情報で利用を許可されているアクセス権限の一覧を取得する。

### CreateScratchProjectFolder
- **RPC**: `rpc CreateScratchProjectFolder(exa.language_server_pb.CreateScratchProjectFolderRequest) returns (exa.language_server_pb.CreateScratchProjectFolderResponse);`
- **Description**: 一時的な実験用・検証用プロジェクトフォルダを生成する。

### GetServerConfiguration
- **RPC**: `rpc GetServerConfiguration(exa.language_server_pb.GetServerConfigurationRequest) returns (exa.language_server_pb.GetServerConfigurationResponse);`
- **Description**: Language Serverが現在動作しているサーバーとしての設定情報を取得する。
