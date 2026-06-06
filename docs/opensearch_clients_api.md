# OpenSearch Clients API Dictionary

## KnowledgeBaseService

### KnowledgeBaseSearch
- **RPC**: `rpc KnowledgeBaseSearch(exa.opensearch_clients_pb.KnowledgeBaseSearchRequest) returns (exa.opensearch_clients_pb.KnowledgeBaseSearchResponse);`
- **Description**: ナレッジベース（外部ドキュメント、URLなど）に対する横断検索を実行する。

### GetKnowledgeBaseScopeItems
- **RPC**: `rpc GetKnowledgeBaseScopeItems(exa.opensearch_clients_pb.GetKnowledgeBaseScopeItemsRequest) returns (exa.opensearch_clients_pb.GetKnowledgeBaseScopeItemsResponse);`
- **Description**: 指定されたインデックスやドキュメント種別を対象に、検索範囲となるスコープ候補を取得する。

### GetKnowledgeBaseItemsFromScopeItems
- **RPC**: `rpc GetKnowledgeBaseItemsFromScopeItems(exa.opensearch_clients_pb.GetKnowledgeBaseItemsFromScopeItemsRequest) returns (exa.opensearch_clients_pb.GetKnowledgeBaseItemsFromScopeItemsResponse);`
- **Description**: スコープ項目から、具体的なナレッジベース項目とメタデータを解決して取得する。

### IngestSlackData
- **RPC**: `rpc IngestSlackData(exa.opensearch_clients_pb.IngestSlackDataRequest) returns (exa.opensearch_clients_pb.IngestSlackDataResponse);`
- **Description**: 指定されたチャンネルのSlackデータをナレッジベースにインポートする。

### IngestGithubData
- **RPC**: `rpc IngestGithubData(exa.opensearch_clients_pb.IngestGithubDataRequest) returns (exa.opensearch_clients_pb.IngestGithubDataResponse);`
- **Description**: 指定されたGitHub組織・リポジトリのデータをインポートする。

### IngestGoogleDriveData
- **RPC**: `rpc IngestGoogleDriveData(exa.opensearch_clients_pb.IngestGoogleDriveDataRequest) returns (exa.opensearch_clients_pb.IngestGoogleDriveDataResponse);`
- **Description**: Googleドライブ内の指定フォルダのデータをインポートする。

### IngestJiraData
- **RPC**: `rpc IngestJiraData(exa.opensearch_clients_pb.IngestJiraDataRequest) returns (exa.opensearch_clients_pb.IngestJiraDataResponse);`
- **Description**: Jiraの課題データをインポートする。

### IngestJiraPayload
- **RPC**: `rpc IngestJiraPayload(exa.opensearch_clients_pb.IngestJiraPayloadRequest) returns (exa.opensearch_clients_pb.IngestJiraPayloadResponse);`
- **Description**: JiraからWebhook経由等で受け取った生の課題ペイロードデータを直接インポートする。

### ForwardSlackPayload
- **RPC**: `rpc ForwardSlackPayload(exa.opensearch_clients_pb.ForwardSlackPayloadRequest) returns (exa.opensearch_clients_pb.ForwardSlackPayloadResponse);`
- **Description**: Slackから受信したペイロードを処理用プロキシや中継サービスに転送する。

### IngestSlackPayload
- **RPC**: `rpc IngestSlackPayload(exa.opensearch_clients_pb.IngestSlackPayloadRequest) returns (exa.opensearch_clients_pb.IngestSlackPayloadResponse);`
- **Description**: Slackから受信したメッセージ・チャンネル等のペイロードデータを取り込む。

### ConnectKnowledgeBaseAccount
- **RPC**: `rpc ConnectKnowledgeBaseAccount(exa.opensearch_clients_pb.ConnectKnowledgeBaseAccountRequest) returns (exa.opensearch_clients_pb.ConnectKnowledgeBaseAccountResponse);`
- **Description**: 各種外部コネクタ（Slack, GitHub等）のアカウント認証情報（OAuthトークン等）を設定・接続する。

### DeleteKnowledgeBaseConnection
- **RPC**: `rpc DeleteKnowledgeBaseConnection(exa.opensearch_clients_pb.DeleteKnowledgeBaseConnectionRequest) returns (exa.opensearch_clients_pb.DeleteKnowledgeBaseConnectionResponse);`
- **Description**: 外部コネクタのアカウント連携を切断し、接続設定を削除する。

### UpdateConnectorConfig
- **RPC**: `rpc UpdateConnectorConfig(exa.opensearch_clients_pb.UpdateConnectorConfigRequest) returns (exa.opensearch_clients_pb.UpdateConnectorConfigResponse);`
- **Description**: 特定コネクタの設定を更新する。

### CancelKnowledgeBaseJobs
- **RPC**: `rpc CancelKnowledgeBaseJobs(exa.opensearch_clients_pb.CancelKnowledgeBaseJobsRequest) returns (exa.opensearch_clients_pb.CancelKnowledgeBaseJobsResponse);`
- **Description**: 実行中のナレッジインポートジョブをキャンセルする。

### GetKnowledgeBaseConnectorState
- **RPC**: `rpc GetKnowledgeBaseConnectorState(exa.opensearch_clients_pb.GetKnowledgeBaseConnectorStateRequest) returns (exa.opensearch_clients_pb.GetKnowledgeBaseConnectorStateResponse);`
- **Description**: 各種コネクタの接続・初期化ステータスおよびドキュメントインデックス件数を取得する。

### GetKnowledgeBaseJobStates
- **RPC**: `rpc GetKnowledgeBaseJobStates(exa.opensearch_clients_pb.GetKnowledgeBaseJobStatesRequest) returns (exa.opensearch_clients_pb.GetKnowledgeBaseJobStatesResponse);`
- **Description**: 実行中または実行待ちのインポートジョブの状態を取得する。

### AddUsers
- **RPC**: `rpc AddUsers(exa.opensearch_clients_pb.AddUsersRequest) returns (exa.opensearch_clients_pb.AddUsersResponse);`
- **Description**: ナレッジベースのインデックス作成またはアクセス管理対象のユーザー情報を追加する。

### AddGithubUsers
- **RPC**: `rpc AddGithubUsers(exa.opensearch_clients_pb.AddGithubUsersRequest) returns (exa.opensearch_clients_pb.AddGithubUsersResponse);`
- **Description**: GitHubアカウントに紐づくユーザーマッピング情報を追加する。

### GetKnowledgeBaseWebhookUrl
- **RPC**: `rpc GetKnowledgeBaseWebhookUrl(exa.opensearch_clients_pb.GetKnowledgeBaseWebhookUrlRequest) returns (exa.opensearch_clients_pb.GetKnowledgeBaseWebhookUrlResponse);`
- **Description**: 外部サービスからデータを受信するためのWebhookエンドポイントURLを取得する。

### GetConnectorInternalConfig
- **RPC**: `rpc GetConnectorInternalConfig(exa.opensearch_clients_pb.GetConnectorInternalConfigRequest) returns (exa.opensearch_clients_pb.GetConnectorInternalConfigResponse);`
- **Description**: 開発用・管理用のコネクタ内部詳細設定を取得する。


## CodeIndexService

### OpenSearchAddRepository
- **RPC**: `rpc OpenSearchAddRepository(exa.opensearch_clients_pb.OpenSearchAddRepositoryRequest) returns (exa.opensearch_clients_pb.OpenSearchAddRepositoryResponse);`
- **Description**: OpenSearchでのコード検索用にリポジトリをインデックス登録対象に追加する。

### OpenSearchGetIndex
- **RPC**: `rpc OpenSearchGetIndex(exa.opensearch_clients_pb.OpenSearchGetIndexRequest) returns (exa.opensearch_clients_pb.OpenSearchGetIndexResponse);`
- **Description**: 指定されたインデックスの進捗・同期ステータスを取得する。

### HybridSearch
- **RPC**: `rpc HybridSearch(exa.opensearch_clients_pb.HybridSearchRequest) returns (exa.opensearch_clients_pb.HybridSearchResponse);`
- **Description**: キーワード検索とベクトル（KNN）検索を組み合わせたハイブリッドコード検索を実行する。

### GraphSearch
- **RPC**: `rpc GraphSearch(exa.opensearch_clients_pb.GraphSearchRequest) returns (exa.opensearch_clients_pb.GraphSearchResponse);`
- **Description**: コードのグラフ関係（クラスや関数の定義・参照関係）を活用した検索を実行する。
