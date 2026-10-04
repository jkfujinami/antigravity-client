# LanguageServerService — RPC Method Index

The full SDK-accessible RPC surface of the Antigravity Language Server, as wrapped
by `LanguageServerFacade` (`src/facade/services.ts`). **290 methods**, of which
**29 are new** in Antigravity IDE 2.5.5 (🆕).

> The Language Server exposes 12 gRPC services / 537 methods total; this index covers
> `exa.language_server_pb.LanguageServerService` — the one the SDK actually wraps and
> the only surface you call through `client.languageServer.*`.

## How to call these

```ts
const client = await AntigravityClient.connect();

// Every method below is a type-safe facade call:
const res = await client.languageServer.getUserStatus({ metadata });
const models = await client.languageServer.getAvailableModels({ metadata });

// High-value flows also have convenience wrappers on the client / Cascade:
const cascade = await client.startCascade();        // wraps StartCascade
await cascade.sendMessage("...");                   // wraps SendUserCascadeMessage
```

**Kind legend:** `unary` = request→response · `→ server-stream` = one request, streamed
responses · `← client-stream` = streamed requests · `⇄ bidi` = both.

Per-method deep-dive docs live alongside this file (`docs/api/<method>.md`) and are written
in **usefulness order** — see the backlog below.

---

## 🧩 Capability guides (cross-cutting)

- [**Token & credit usage**](token-usage.md) — read per-call token counts (`step.metadata.model_usage`), cost, and account credits. *(verified)*
- [**Context scope items**](context-scope-items.md) — the 27-case @-mention vocabulary for attaching context to a message.
- [**Reference: default agent prompt dump**](reference/README.md) — the full unmodified system prompt (31k chars / ~20.6k tok), 18 tool defs, and message envelope, kept for diffing.
- [**System-prompt control**](system-prompt-control.md) — observe / strip / hijack / **zero-out** the system prompt. *(verified: 12,491 → 312 input tokens = −97.5%, tools+history+prompt all removed via `declarativeMixinConfig`; identity override)*

- [**Real-time voice conversation**](voice-realtime-design.md) — feasibility + design: native streaming STT (`StreamAudioTranscription`/`SendAudioChunk`, verified live) → cascade → external TTS. *(no server-side TTS)*

## 📌 Documentation backlog (priority order)

The methods worth accurate, hand-written docs first — chosen for power, non-obviousness,
or because they're new. Checked = done.

### Tier 1 — Core agent loop (the SDK's reason to exist)
- [x] **`StartCascade`** — open an agent session; the big configurable entry point (workspace, model, custom agent spec, sandbox). → [start-cascade.md](start-cascade.md)
- [x] **`SendUserCascadeMessage`** — send a user turn into a running cascade. → [send-user-cascade-message.md](send-user-cascade-message.md) · nested context vocabulary → [context-scope-items.md](context-scope-items.md)
- [x] **`StreamCascadeReactiveUpdates`** — ⚠️ deprecated on the server; the SDK's real event stream is `StreamAgentStateUpdates`. Both analyzed → [stream-cascade-reactive-updates.md](stream-cascade-reactive-updates.md)
- [ ] **`HandleCascadeUserInteraction`** — approve/deny commands, file edits, browser actions
- [ ] **`GetCascadeTrajectory` / `GetCascadeTrajectorySteps`** — read full history/steps
- [ ] **`CancelCascadeSteps` / `ForceStopCascadeTree`** — stop in-flight work

### Tier 2 — One-shot & models
- [ ] **`GetModelResponse`** — one-shot inference without a full cascade
- [ ] **`GetAvailableModels` / `GetModelStatuses`** — model discovery (27 live models)
- [ ] 🆕 **`GetInputCompletion`** — inline/tab completion endpoint

### Tier 3 — Unique/interesting capabilities
- [ ] **`StartBattleMode` / `EndBattleMode`** (+🆕 `DetectBattleModeAutoTrigger`, `EliminateBattleModeArm`, `GetBattleWorktreeDiff`) — fork the agent into competing arms and merge
- [ ] **Terminal suite** — `CreateTerminal` / `StreamTerminalOutput` / `RunCommand` / `SendTerminalInput` (+🆕 `ValidateTerminalSetupScript`)
- [ ] **Browser suite** — `OpenUrl` / `CaptureScreenshot` / `SmartOpenBrowser` / `SkipBrowserSubagent`
- [ ] **Git/JJ suite** — `GitStage`/`GitCommit`/`GitDiscard` + 🆕 `JjSync`/`JjCommit`/`JjSquash`/`JjUpload`/`CheckoutCommit`
- [ ] 🆕 **`UploadToDrive` / `SearchDriveFiles`** — Google Drive integration
- [ ] **`CreateTrajectoryShare` / 🆕 `LoadSharedTrajectory` / `ConvertTrajectoryToMarkdown`** — share & export sessions
- [ ] **Audio/media** — `StreamAudioTranscription` / `SendAudioChunk` / `StartScreenRecording` / `SaveMediaAsArtifact` (surprising surface!)
- [ ] 🆕 **`CreateMagicProject` / `DisassembleProject`** — scaffold / tear down projects
- [ ] **MCP suite** — `GetMcpServerStates` / `ToggleMcpServer` / `ManageSidecar` / `ListMcpResources`
- [ ] **Memory** — `GetCascadeMemories` / `UpdateCascadeMemory` / `GetUserMemories`

### Tier 4 — New auth/admin (2.5.5)
- [ ] 🆕 **`Login` / `ListLicenses` / `SelectLicense` / `SelfAssignLicense`** — license management flow
- [ ] 🆕 **`FetchAdminControls`** — org agent/browser/MCP controls
- [ ] 🆕 **`GetCapabilities`** — capability discovery handshake

### Fun / low-priority
- [ ] `SimulateSegFault` (crash the LS on purpose), `DumpFlightRecorder`, `DumpPprof`, `Heartbeat`, `Exit`, `Restart`

---

## Full catalog (by category)

### Cascade / Agent core (58)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `AcknowledgeCascadeCodeEdit` | unary | `AcknowledgeCascadeCodeEditRequest` → `AcknowledgeCascadeCodeEditResponse` |
|  | `AcknowledgeCodeActionStep` | unary | `AcknowledgeCodeActionStepRequest` → `AcknowledgeCodeActionStepResponse` |
|  | `BrowserValidateCascadeOrCancelOverlay` | unary | `BrowserValidateCascadeOrCancelOverlayRequest` → `BrowserValidateCascadeOrCancelOverlayResponse` |
|  | `CancelCascadeInvocation` | unary | `CancelCascadeInvocationRequest` → `CancelCascadeInvocationResponse` |
|  | `CancelCascadeSteps` | unary | `CancelCascadeStepsRequest` → `CancelCascadeStepsResponse` |
|  | `ConvertTrajectoryToMarkdown` | unary | `ConvertTrajectoryToMarkdownRequest` → `ConvertTrajectoryToMarkdownResponse` |
|  | `CreateTrajectoryShare` | unary | `CreateTrajectoryShareRequest` → `CreateTrajectoryShareResponse` |
|  | `DeleteAgentMessage` | unary | `DeleteAgentMessageRequest` → `DeleteAgentMessageResponse` |
|  | `DeleteCascadeMemory` | unary | `DeleteCascadeMemoryRequest` → `DeleteCascadeMemoryResponse` |
|  | `DeleteCascadeTrajectory` | unary | `DeleteCascadeTrajectoryRequest` → `DeleteCascadeTrajectoryResponse` |
|  | `DeleteQueuedUserInputStep` | unary | `DeleteQueuedUserInputStepRequest` → `DeleteQueuedUserInputStepResponse` |
|  | `DetectBattleModeAutoTrigger` | unary | `DetectBattleModeAutoTriggerRequest` → `DetectBattleModeAutoTriggerResponse` |
|  | `EliminateBattleModeArm` | unary | `EliminateBattleModeArmRequest` → `EliminateBattleModeArmResponse` |
|  | `EndBattleMode` | unary | `EndBattleModeRequest` → `EndBattleModeResponse` |
|  | `ForceStopCascadeTree` | unary | `ForceStopCascadeTreeRequest` → `ForceStopCascadeTreeResponse` |
|  | `GetAgentScripts` | unary | `GetAgentScriptsRequest` → `GetAgentScriptsResponse` |
|  | `GetAgentTeamMetadata` | unary | `GetAgentTeamMetadataRequest` → `GetAgentTeamMetadataResponse` |
|  | `GetAllCascadeTrajectories` | unary | `GetAllCascadeTrajectoriesRequest` → `GetAllCascadeTrajectoriesResponse` |
|  | `GetAllCustomAgentConfigs` | unary | `GetAllCustomAgentConfigsRequest` → `GetAllCustomAgentConfigsResponse` |
|  | `GetAvailableCascadePlugins` | unary | `GetAvailableCascadePluginsRequest` → `GetAvailableCascadePluginsResponse` |
| 🆕 | `GetBattleWorktreeDiff` | unary | `GetBattleWorktreeDiffRequest` → `GetBattleWorktreeDiffResponse` |
|  | `GetCascadeMemories` | unary | `GetCascadeMemoriesRequest` → `GetCascadeMemoriesResponse` |
|  | `GetCascadeModelConfigData` | unary | `GetCascadeModelConfigDataRequest` → `CascadeModelConfigData` |
|  | `GetCascadeModelConfigs` | unary | `GetCascadeModelConfigsRequest` → `GetCascadeModelConfigsResponse` |
|  | `GetCascadeNuxes` | unary | `GetCascadeNuxesRequest` → `GetCascadeNuxesResponse` |
|  | `GetCascadePluginById` | unary | `GetCascadePluginByIdRequest` → `GetCascadePluginByIdResponse` |
|  | `GetCascadeTrajectory` | unary | `GetCascadeTrajectoryRequest` → `GetCascadeTrajectoryResponse` |
|  | `GetCascadeTrajectoryExecutorMetadatas` | unary | `GetCascadeTrajectoryExecutorMetadatasRequest` → `GetCascadeTrajectoryExecutorMetadatasResponse` |
|  | `GetCascadeTrajectoryGeneratorMetadata` | unary | `GetCascadeTrajectoryGeneratorMetadataRequest` → `GetCascadeTrajectoryGeneratorMetadataResponse` |
|  | `GetCascadeTrajectorySteps` | unary | `GetCascadeTrajectoryStepsRequest` → `GetCascadeTrajectoryStepsResponse` |
|  | `GetTurnDiff` | unary | `GetTurnDiffRequest` → `GetTurnDiffResponse` |
|  | `GetUserTrajectory` | unary | `GetUserTrajectoryRequest` → `GetUserTrajectoryResponse` |
|  | `GetUserTrajectoryDebug` | unary | `GetUserTrajectoryDebugRequest` → `GetUserTrajectoryDebugResponse` |
|  | `GetUserTrajectoryDescriptions` | unary | `GetUserTrajectoryDescriptionsRequest` → `GetUserTrajectoryDescriptionsResponse` |
|  | `HandleCascadeUserInteraction` | unary | `HandleCascadeUserInteractionRequest` → `HandleCascadeUserInteractionResponse` |
|  | `InitializeCascadePanelState` | unary | `InitializeCascadePanelStateRequest` → `InitializeCascadePanelStateResponse` |
|  | `InstallCascadePlugin` | unary | `InstallCascadePluginRequest` → `InstallCascadePluginResponse` |
| 🆕 | `LoadSharedTrajectory` | unary | `LoadSharedTrajectoryRequest` → `LoadSharedTrajectoryResponse` |
|  | `LoadTrajectory` | unary | `LoadTrajectoryRequest` → `LoadTrajectoryResponse` |
|  | `RecordInteractiveCascadeFeedback` | unary | `RecordInteractiveCascadeFeedbackRequest` → `RecordInteractiveCascadeFeedbackResponse` |
|  | `RecordUserStepSnapshot` | unary | `RecordUserStepSnapshotRequest` → `RecordUserStepSnapshotResponse` |
|  | `ReplayGroundTruthTrajectory` | unary | `ReplayGroundTruthTrajectoryRequest` → `ReplayGroundTruthTrajectoryResponse` |
|  | `RequestAgentStatePageUpdate` | unary | `AgentStatePageUpdateRequest` → `AgentStatePageUpdateResponse` |
|  | `ResolveOutstandingSteps` | unary | `ResolveOutstandingStepsRequest` → `ResolveOutstandingStepsResponse` |
|  | `RevertToCascadeStep` | unary | `RevertToCascadeStepRequest` → `RevertToCascadeStepResponse` |
|  | `SaveAgentScriptCommandSpec` | unary | `SaveAgentScriptCommandSpecRequest` → `SaveAgentScriptCommandSpecResponse` |
|  | `SendAgentMessage` | unary | `SendAgentMessageRequest` → `SendAgentMessageResponse` |
|  | `SendStepsToBackground` | unary | `SendStepsToBackgroundRequest` → `SendStepsToBackgroundResponse` |
|  | `SendUserCascadeMessage` | unary | `SendUserCascadeMessageRequest` → `SendUserCascadeMessageResponse` |
|  | `SkipBrowserSubagent` | unary | `SkipBrowserSubagentRequest` → `SkipBrowserSubagentResponse` |
|  | `StartBattleMode` | unary | `StartBattleModeRequest` → `StartBattleModeResponse` |
|  | `StartCascade` | unary | `StartCascadeRequest` → `StartCascadeResponse` |
|  | `StreamAgentStateUpdates` | → server-stream | `StreamAgentStateUpdatesRequest` → `StreamAgentStateUpdatesResponse` |
|  | `StreamCascadePanelReactiveUpdates` | → server-stream | `StreamReactiveUpdatesRequest` → `StreamReactiveUpdatesResponse` |
|  | `StreamCascadeReactiveUpdates` | → server-stream | `StreamReactiveUpdatesRequest` → `StreamReactiveUpdatesResponse` |
|  | `StreamCascadeSummariesReactiveUpdates` | → server-stream | `StreamReactiveUpdatesRequest` → `StreamReactiveUpdatesResponse` |
|  | `StreamUserTrajectoryReactiveUpdates` | → server-stream | `StreamReactiveUpdatesRequest` → `StreamReactiveUpdatesResponse` |
|  | `UpdateCascadeMemory` | unary | `UpdateCascadeMemoryRequest` → `UpdateCascadeMemoryResponse` |

### Chat / Messaging (20)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `ForkConversation` | unary | `ForkConversationRequest` → `ForkConversationResponse` |
|  | `GenerateCommitMessage` | unary | `GenerateCommitMessageRequest` → `GenerateCommitMessageResponse` |
|  | `GetBrowserOpenConversation` | unary | `GetBrowserOpenConversationRequest` → `GetBrowserOpenConversationResponse` |
|  | `GetConversationMetadata` | unary | `GetConversationMetadataRequest` → `GetConversationMetadataResponse` |
|  | `GetMcpPrompt` | unary | `GetMcpPromptRequest` → `GetMcpPromptResponse` |
|  | `ListMcpPrompts` | unary | `ListMcpPromptsRequest` → `ListMcpPromptsResponse` |
|  | `LoadReplayConversation` | unary | `LoadReplayConversationRequest` → `LoadReplayConversationResponse` |
|  | `ProvideCompletionFeedback` | unary | `ProvideCompletionFeedbackRequest` → `ProvideCompletionFeedbackResponse` |
|  | `RecordChatFeedback` | unary | `RecordChatFeedbackRequest` → `RecordChatFeedbackResponse` |
|  | `RecordChatPanelSession` | unary | `RecordChatPanelSessionRequest` → `RecordChatPanelSessionResponse` |
|  | `RecordCommitMessageSave` | unary | `RecordCommitMessageSaveRequest` → `RecordCommitMessageSaveResponse` |
|  | `SearchConversations` | unary | `SearchConversationsRequest` → `SearchConversationsResponse` |
|  | `SendActionToChatPanel` | unary | `SendActionToChatPanelRequest` → `SendActionToChatPanelResponse` |
|  | `SendAllQueuedMessages` | unary | `SendAllQueuedMessagesRequest` → `SendAllQueuedMessagesResponse` |
| 🆕 | `SendInputCompletionFeedback` | unary | `SendInputCompletionFeedbackRequest` → `SendInputCompletionFeedbackResponse` |
|  | `SetBrowserOpenConversation` | unary | `SetBrowserOpenConversationRequest` → `SetBrowserOpenConversationResponse` |
|  | `SetupJetskiChat` | → server-stream | `SetupJetskiChatRequest` → `SetupJetskiChatResponse` |
|  | `SmartFocusConversation` | unary | `SmartFocusConversationRequest` → `SmartFocusConversationResponse` |
|  | `UpdateConversationAnnotations` | unary | `UpdateConversationAnnotationsRequest` → `UpdateConversationAnnotationsResponse` |
|  | `WaitForConversationFullyIdle` | unary | `WaitForConversationFullyIdleRequest` → `WaitForConversationFullyIdleResponse` |

### Model / Inference (5)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `GetAvailableModels` | unary | `GetAvailableModelsRequest` → `GetAvailableModelsResponse` |
|  | `GetCommandModelConfigs` | unary | `GetCommandModelConfigsRequest` → `GetCommandModelConfigsResponse` |
| 🆕 | `GetInputCompletion` | unary | `GetInputCompletionRequest` → `GetInputCompletionResponse` |
|  | `GetModelResponse` | unary | `GetModelResponseRequest` → `GetModelResponseResponse` |
|  | `GetModelStatuses` | unary | `GetModelStatusesRequest` → `GetModelStatusesResponse` |

### Terminal / Command (11)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `CloseTerminal` | unary | `CloseTerminalRequest` → `CloseTerminalResponse` |
|  | `CreateTerminal` | unary | `CreateTerminalRequest` → `CreateTerminalResponse` |
|  | `GetSlashCommands` | unary | `GetSlashCommandsRequest` → `GetSlashCommandsResponse` |
|  | `HandleStreamingCommand` | → server-stream | `HandleStreamingCommandRequest` → `HandleStreamingCommandResponse` |
|  | `ListTerminals` | unary | `ListTerminalsRequest` → `ListTerminalsResponse` |
|  | `RunCommand` | unary | `RunCommandRequest` → `RunCommandResponse` |
|  | `SendTerminalInput` | unary | `SendTerminalInputRequest` → `SendTerminalInputResponse` |
|  | `SignalExecutableIdle` | unary | `SignalExecutableIdleRequest` → `SignalExecutableIdleResponse` |
|  | `StreamTerminalOutput` | → server-stream | `StreamTerminalOutputRequest` → `StreamTerminalOutputResponse` |
|  | `StreamTerminalShellCommand` | ← client-stream | `TerminalShellCommandStreamChunk` → `StreamTerminalShellCommandResponse` |
| 🆕 | `ValidateTerminalSetupScript` | unary | `ValidateTerminalSetupScriptRequest` → `ValidateTerminalSetupScriptResponse` |

### Git / VCS / JJ (27)

| New | Method | Kind | I/O |
|:-:|---|---|---|
| 🆕 | `CheckoutCommit` | unary | `CheckoutCommitRequest` → `CheckoutCommitResponse` |
|  | `CheckoutWorktree` | unary | `CheckoutWorktreeRequest` → `CheckoutWorktreeResponse` |
|  | `CreateWorktree` | unary | `CreateWorktreeRequest` → `CreateWorktreeResponse` |
|  | `DeleteWorktree` | unary | `DeleteWorktreeRequest` → `DeleteWorktreeResponse` |
|  | `FigAmend` | unary | `FigAmendRequest` → `FigAmendResponse` |
|  | `FigCommit` | unary | `FigCommitRequest` → `FigCommitResponse` |
|  | `FigSync` | unary | `FigSyncRequest` → `FigSyncResponse` |
|  | `FigUpload` | unary | `FigUploadRequest` → `FigUploadResponse` |
| 🆕 | `GetCodeActionDiff` | unary | `GetCodeActionDiffRequest` → `GetCodeActionDiffResponse` |
|  | `GetCodeFrequencyForRepo` | unary | `GetCodeFrequencyForRepoRequest` → `GetCodeFrequencyForRepoResponse` |
|  | `GetCommitDetails` | unary | `GetCommitDetailsRequest` → `GetCommitDetailsResponse` |
| 🆕 | `GetJJWorktrees` | unary | `GetJJWorktreesRequest` → `GetJJWorktreesResponse` |
|  | `GetRepoInfos` | unary | `GetRepoInfosRequest` → `GetRepoInfosResponse` |
|  | `GetVersionControlFileContent` | unary | `GetVersionControlFileContentRequest` → `GetVersionControlFileContentResponse` |
|  | `GetVersionControlState` | unary | `GetVersionControlStateRequest` → `GetVersionControlStateResponse` |
|  | `GetWorktreeDiff` | unary | `GetWorktreeDiffRequest` → `GetWorktreeDiffResponse` |
|  | `GitCommit` | unary | `GitCommitRequest` → `GitCommitResponse` |
|  | `GitDiscard` | unary | `GitDiscardRequest` → `GitDiscardResponse` |
|  | `GitStage` | unary | `GitStageRequest` → `GitStageResponse` |
|  | `GitUnstage` | unary | `GitUnstageRequest` → `GitUnstageResponse` |
| 🆕 | `JjCommit` | unary | `JjCommitRequest` → `JjCommitResponse` |
| 🆕 | `JjSquash` | unary | `JjSquashRequest` → `JjSquashResponse` |
| 🆕 | `JjSync` | unary | `JjSyncRequest` → `JjSyncResponse` |
| 🆕 | `JjUpload` | unary | `JjUploadRequest` → `JjUploadResponse` |
| 🆕 | `ListGobRepos` | unary | `ListGobReposRequest` → `ListGobReposResponse` |
|  | `UpdatePRForWorktree` | unary | `UpdatePRForWorktreeRequest` → `UpdatePRForWorktreeResponse` |
|  | `WatchVersionControlState` | → server-stream | `WatchVersionControlStateRequest` → `WatchVersionControlStateResponse` |

### File / Workspace (40)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `AddTrackedWorkspace` | unary | `AddTrackedWorkspaceRequest` → `AddTrackedWorkspaceResponse` |
| 🆕 | `BackupGeminiDir` | unary | `BackupGeminiDirRequest` → `BackupGeminiDirResponse` |
|  | `CopyBuiltinWorkflowToWorkspace` | unary | `CopyBuiltinWorkflowToWorkspaceRequest` → `CopyBuiltinWorkflowToWorkspaceResponse` |
|  | `CreateCitcWorkspace` | unary | `CreateCitcWorkspaceRequest` → `CreateCitcWorkspaceResponse` |
|  | `CreateCustomizationFile` | unary | `CreateCustomizationFileRequest` → `CreateCustomizationFileResponse` |
|  | `CreateScratchProjectFolder` | unary | `CreateScratchProjectFolderRequest` → `CreateScratchProjectFolderResponse` |
|  | `DeleteFileOrDirectory` | unary | `DeleteFileOrDirectoryRequest` → `DeleteFileOrDirectoryResponse` |
| 🆕 | `DiscardFileChanges` | unary | `DiscardFileChangesRequest` → `DiscardFileChangesResponse` |
|  | `GetAuthStatus` | unary | `GetAuthStatusRequest` → `GetAuthStatusResponse` |
|  | `GetBrowserWhitelistFilePath` | unary | `GetBrowserWhitelistFilePathRequest` → `GetBrowserWhitelistFilePathResponse` |
|  | `GetCodeValidationStates` | unary | `GetCodeValidationStatesRequest` → `GetCodeValidationStatesResponse` |
|  | `GetDefaultProjectDir` | unary | `GetDefaultProjectDirRequest` → `GetDefaultProjectDirResponse` |
|  | `GetMcpServerStates` | unary | `GetMcpServerStatesRequest` → `GetMcpServerStatesResponse` |
|  | `GetStandaloneDir` | unary | `GetStandaloneDirRequest` → `GetStandaloneDirResponse` |
|  | `GetStaticExperimentStatus` | unary | `GetStaticExperimentStatusRequest` → `GetStaticExperimentStatusResponse` |
|  | `GetStatus` | unary | `GetStatusRequest` → `GetStatusResponse` |
|  | `GetUserStatus` | unary | `GetUserStatusRequest` → `GetUserStatusResponse` |
|  | `GetWorkingDirectories` | unary | `GetWorkingDirectoriesRequest` → `GetWorkingDirectoriesResponse` |
|  | `GetWorkspaceEditState` | unary | `GetWorkspaceEditStateRequest` → `GetWorkspaceEditStateResponse` |
|  | `GetWorkspaceInfos` | unary | `GetWorkspaceInfosRequest` → `GetWorkspaceInfosResponse` |
|  | `JetboxSubscribeToGcertState` | → server-stream | `JetboxSubscribeToGcertStateRequest` → `JetboxSubscribeToGcertStateResponse` |
|  | `JetboxSubscribeToOAuthState` | → server-stream | `JetboxSubscribeToOAuthStateRequest` → `JetboxSubscribeToOAuthStateResponse` |
|  | `JetboxSubscribeToState` | → server-stream | `JetboxSubscribeToStateRequest` → `JetboxSubscribeToStateResponse` |
|  | `JetboxWriteState` | unary | `JetboxWriteStateRequest` → `JetboxWriteStateResponse` |
|  | `ListCustomizationPathsByFile` | unary | `ListCustomizationPathsByFileRequest` → `ListCustomizationPathsByFileResponse` |
|  | `ListSidecarLogFiles` | unary | `ListSidecarLogFilesRequest` → `ListSidecarLogFilesResponse` |
|  | `ReadDir` | unary | `ReadDirRequest` → `ReadDirResponse` |
|  | `ReadFile` | unary | `ReadFileRequest` → `ReadFileResponse` |
|  | `RemoveTrackedWorkspace` | unary | `RemoveTrackedWorkspaceRequest` → `RemoveTrackedWorkspaceResponse` |
|  | `ResolveFolder` | unary | `ResolveFolderRequest` → `ResolveFolderResponse` |
|  | `ResolveWorkspaceUrlPreview` | unary | `ResolveWorkspaceUrlPreviewRequest` → `ResolveWorkspaceUrlPreviewResponse` |
|  | `ScanSkillsConfigFile` | unary | `ScanSkillsConfigFileRequest` → `ScanSkillsConfigFileResponse` |
| 🆕 | `SearchDriveFiles` | unary | `SearchDriveFilesRequest` → `SearchDriveFilesResponse` |
|  | `SearchFiles` | unary | `SearchFilesRequest` → `SearchFilesResponse` |
|  | `SetOrVerifyStaticConfig` | unary | `SetOrVerifyStaticConfigRequest` → `SetOrVerifyStaticConfigResponse` |
|  | `SetWorkingDirectories` | unary | `SetWorkingDirectoriesRequest` → `SetWorkingDirectoriesResponse` |
|  | `StatUri` | unary | `StatUriRequest` → `StatUriResponse` |
|  | `UpdateCustomizationPathsFile` | unary | `UpdateCustomizationPathsFileRequest` → `UpdateCustomizationPathsFileResponse` |
|  | `WatchDirectory` | → server-stream | `WatchDirectoryRequest` → `WatchDirectoryResponse` |
|  | `WriteFile` | unary | `WriteFileRequest` → `WriteFileResponse` |

### Browser (8)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `AddToBrowserWhitelist` | unary | `AddToBrowserWhitelistRequest` → `AddToBrowserWhitelistResponse` |
|  | `CaptureScreenshot` | unary | `CaptureScreenshotRequest` → `CaptureScreenshotResponse` |
|  | `GetAllBrowserWhitelistedUrls` | unary | `GetAllBrowserWhitelistedUrlsRequest` → `GetAllBrowserWhitelistedUrlsResponse` |
|  | `ImportProjectFromUrl` | unary | `ImportProjectFromUrlRequest` → `ImportProjectFromUrlResponse` |
|  | `LoginWithBrowser` | unary | `LoginWithBrowserRequest` → `LoginWithBrowserResponse` |
|  | `OpenUrl` | unary | `OpenUrlRequest` → `OpenUrlResponse` |
|  | `SmartOpenBrowser` | unary | `SmartOpenBrowserRequest` → `SmartOpenBrowserResponse` |
|  | `UpdateEnterpriseExperimentsFromUrl` | unary | `UpdateEnterpriseExperimentsFromUrlRequest` → `UpdateEnterpriseExperimentsFromUrlResponse` |

### Search / Index / Knowledge (12)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `GetAllRules` | unary | `GetAllRulesRequest` → `GetAllRulesResponse` |
|  | `GetGrantedScopes` | unary | `GetGrantedScopesRequest` → `GetGrantedScopesResponse` |
|  | `GetKnowledgeItems` | unary | `GetKnowledgeItemsRequest` → `GetKnowledgeItemsResponse` |
|  | `GetMatchingContextScopeItems` | unary | `GetMatchingContextScopeItemsRequest` → `GetMatchingContextScopeItemsResponse` |
|  | `RecordSearchDocOpen` | unary | `RecordSearchDocOpenRequest` → `RecordSearchDocOpenResponse` |
|  | `RecordSearchResultsView` | unary | `RecordSearchResultsViewRequest` → `RecordSearchResultsViewResponse` |
|  | `RecordUserGrep` | unary | `RecordUserGrepRequest` → `RecordUserGrepResponse` |
|  | `RefreshContextForIdeAction` | unary | `RefreshContextForIdeActionRequest` → `RefreshContextForIdeActionResponse` |
|  | `RetrieveUserQuotaSummary` | unary | `RetrieveUserQuotaSummaryRequest` → `RetrieveUserQuotaSummaryResponse` |
|  | `SearchCode` | unary | `SearchCodeRequest` → `SearchCodeResponse` |
| 🆕 | `SearchMarketplaceCustomizations` | unary | `SearchMarketplaceCustomizationsRequest` → `SearchMarketplaceCustomizationsResponse` |
| 🆕 | `StreamSearchCode` | → server-stream | `SearchCodeRequest` → `StreamSearchCodeResponse` |

### Auth / User / License / Admin (23)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `AcceptTermsOfService` | unary | `AcceptTermsOfServiceRequest` → `AcceptTermsOfServiceResponse` |
|  | `AuthLogout` | unary | `AuthLogoutRequest` → `AuthLogoutResponse` |
|  | `CompleteMcpOAuth` | unary | `CompleteMcpOAuthRequest` → `CompleteMcpOAuthResponse` |
|  | `DisconnectMcpOAuth` | unary | `DisconnectMcpOAuthRequest` → `DisconnectMcpOAuthResponse` |
| 🆕 | `FetchAdminControls` | unary | `FetchAdminControlsRequest` → `FetchAdminControlsResponse` |
|  | `FetchUserInfo` | unary | `FetchUserInfoRequest` → `FetchUserInfoResponse` |
|  | `FocusUserPage` | unary | `FocusUserPageRequest` → `FocusUserPageResponse` |
|  | `GetLocalUserInfo` | unary | `GetLocalUserInfoRequest` → `GetLocalUserInfoResponse` |
|  | `GetTeamOrganizationalControls` | unary | `GetTeamOrganizationalControlsRequest` → `GetTeamOrganizationalControlsResponse` |
|  | `GetTermsOfService` | unary | `GetTermsOfServiceRequest` → `GetTermsOfServiceResponse` |
|  | `GetUserAnalyticsSummary` | unary | `GetUserAnalyticsSummaryRequest` → `GetUserAnalyticsSummaryResponse` |
|  | `GetUserMemories` | unary | `GetUserMemoriesRequest` → `GetUserMemoriesResponse` |
|  | `GetUserSettings` | unary | `GetUserSettingsRequest` → `GetUserSettingsResponse` |
|  | `HasAuthToken` | unary | `HasAuthTokenRequest` → `HasAuthTokenResponse` |
| 🆕 | `ListLicenses` | unary | `ListLicensesRequest` → `ListLicensesResponse` |
| 🆕 | `Login` | unary | `LoginRequest` → `LoginResponse` |
|  | `RegisterGdmUser` | unary | `RegisterGdmUserRequest` → `RegisterGdmUserResponse` |
|  | `ResetOnboarding` | unary | `ResetOnboardingRequest` → `ResetOnboardingResponse` |
| 🆕 | `SelectLicense` | unary | `SelectLicenseRequest` → `SelectLicenseResponse` |
| 🆕 | `SelfAssignLicense` | unary | `SelfAssignLicenseRequest` → `SelfAssignLicenseResponse` |
|  | `SetUserInfo` | unary | `SetUserInfoRequest` → `SetUserInfoResponse` |
|  | `SetUserSettings` | unary | `SetUserSettingsRequest` → `SetUserSettingsResponse` |
|  | `SkipOnboarding` | unary | `SkipOnboardingRequest` → `SkipOnboardingResponse` |

### MCP / Plugins / Tools / Sidecar (17)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `CheckDevToolsActivePort` | unary | `CheckDevToolsActivePortRequest` → `CheckDevToolsActivePortResponse` |
|  | `DeletePlugin` | unary | `DeletePluginRequest` → `DeletePluginResponse` |
|  | `DownloadBuildWithGooglePlugin` | unary | `DownloadBuildWithGooglePluginRequest` → `DownloadBuildWithGooglePluginResponse` |
|  | `GetAllPlugins` | unary | `GetAllPluginsRequest` → `GetAllPluginsResponse` |
|  | `GetBuildWithGooglePlugins` | unary | `GetBuildWithGooglePluginsRequest` → `GetBuildWithGooglePluginsResponse` |
|  | `GetMcpServerTemplates` | unary | `GetMcpServerTemplatesRequest` → `GetMcpServerTemplatesResponse` |
|  | `GetSidecarEvents` | unary | `GetSidecarEventsRequest` → `GetSidecarEventsResponse` |
|  | `GetSidecarLogs` | → server-stream | `GetSidecarLogsRequest` → `GetSidecarLogsResponse` |
|  | `GetSidecars` | unary | `GetSidecarsRequest` → `GetSidecarsResponse` |
|  | `ListMcpResources` | unary | `ListMcpResourcesRequest` → `ListMcpResourcesResponse` |
|  | `ManageSidecar` | unary | `ManageSidecarRequest` → `ManageSidecarResponse` |
|  | `ReconnectExtensionServer` | unary | `ReconnectExtensionServerRequest` → `ReconnectExtensionServerResponse` |
|  | `RecordSidecarEvent` | unary | `RecordSidecarEventRequest` → `RecordSidecarEventResponse` |
|  | `RefreshMcpServers` | unary | `RefreshMcpServersRequest` → `RefreshMcpServersResponse` |
| 🆕 | `ResolveSidecarConfig` | unary | `ResolveSidecarConfigRequest` → `ResolveSidecarConfigResponse` |
|  | `SubscribeToSidecars` | → server-stream | `SubscribeToSidecarsRequest` → `SubscribeToSidecarsResponse` |
|  | `ToggleMcpServer` | unary | `ToggleMcpServerRequest` → `ToggleMcpServerResponse` |

### Drive / Cloud / Project (14)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `AddEnvironmentToProject` | unary | `AddEnvironmentToProjectRequest` → `AddEnvironmentToProjectResponse` |
| 🆕 | `CreateDebugBundle` | unary | `CreateDebugBundleRequest` → `CreateDebugBundleResponse` |
| 🆕 | `CreateMagicProject` | unary | `CreateMagicProjectRequest` → `CreateMagicProjectResponse` |
|  | `CreateProject` | unary | `CreateProjectRequest` → `CreateProjectResponse` |
|  | `DeleteProject` | unary | `DeleteProjectRequest` → `DeleteProjectResponse` |
| 🆕 | `DisassembleProject` | unary | `DisassembleProjectRequest` → `DisassembleProjectResponse` |
|  | `GenerateEnvironmentName` | unary | `GenerateEnvironmentNameRequest` → `GenerateEnvironmentNameResponse` |
|  | `IsProjectsEnabledInternally` | unary | `IsProjectsEnabledInternallyRequest` → `IsProjectsEnabledInternallyResponse` |
|  | `ProjectUpdatesStream` | → server-stream | `ProjectUpdatesStreamRequest` → `ProjectUpdatesStreamResponse` |
|  | `ReadProject` | unary | `ReadProjectRequest` → `ReadProjectResponse` |
|  | `SetCloudCodeURL` | unary | `SetCloudCodeURLRequest` → `SetCloudCodeURLResponse` |
|  | `UpdateProject` | unary | `UpdateProjectRequest` → `UpdateProjectResponse` |
| 🆕 | `UploadToDrive` | unary | `UploadToDriveRequest` → `UploadToDriveResponse` |
|  | `ValidateProject` | unary | `ValidateProjectRequest` → `ValidateProjectResponse` |

### Config / Settings / Flags (7)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `GetMendelFlags` | unary | `GetMendelFlagsRequest` → `GetMendelFlagsResponse` |
|  | `GetServerConfiguration` | unary | `GetServerConfigurationRequest` → `GetServerConfigurationResponse` |
|  | `GetUnleashData` | unary | `GetUnleashDataRequest` → `GetUnleashDataResponse` |
|  | `GetWebDocsOptions` | unary | `GetWebDocsOptionsRequest` → `GetWebDocsOptionsResponse` |
|  | `SetBaseExperiments` | unary | `SetBaseExperimentsRequest` → `SetBaseExperimentsResponse` |
|  | `ShouldEnableUnleash` | unary | `ShouldEnableUnleashRequest` → `ShouldEnableUnleashResponse` |
|  | `UpdateDevExperiments` | unary | `UpdateDevExperimentsRequest` → `UpdateDevExperimentsResponse` |

### Skills / Workflows / Customization (6)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `GenerateSkillInstallationCL` | unary | `GenerateSkillInstallationCLRequest` → `GenerateSkillInstallationCLResponse` |
|  | `GetAllSkills` | unary | `GetAllSkillsRequest` → `GetAllSkillsResponse` |
|  | `GetAllWorkflows` | unary | `GetAllWorkflowsRequest` → `GetAllWorkflowsResponse` |
|  | `GetChangelog` | unary | `GetChangelogRequest` → `GetChangelogResponse` |
|  | `GetSkillMarketplaceLink` | unary | `GetSkillMarketplaceLinkRequest` → `GetSkillMarketplaceLinkResponse` |
|  | `UpdateCustomization` | unary | `UpdateCustomizationRequest` → `UpdateCustomizationResponse` |

### Audio / Media / Recording (17)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `DeleteMediaArtifact` | unary | `DeleteMediaArtifactRequest` → `DeleteMediaArtifactResponse` |
|  | `DumpFlightRecorder` | unary | `DumpFlightRecorderRequest` → `DumpFlightRecorderResponse` |
|  | `EndAudioSession` | unary | `EndAudioSessionRequest` → `EndAudioSessionResponse` |
|  | `GetArtifactSnapshots` | unary | `GetArtifactSnapshotsRequest` → `GetArtifactSnapshotsResponse` |
|  | `GetRevisionArtifact` | unary | `GetRevisionArtifactRequest` → `GetRevisionArtifactResponse` |
|  | `GetTranscription` | unary | `GetTranscriptionRequest` → `GetTranscriptionResponse` |
|  | `HandleScreenRecording` | unary | `HandleScreenRecordingRequest` → `HandleScreenRecordingResponse` |
|  | `RecordAnalyticsEvent` | unary | `RecordAnalyticsEventRequest` → `RecordAnalyticsEventResponse` |
|  | `RecordError` | unary | `RecordErrorRequest` → `RecordErrorResponse` |
|  | `RecordEvent` | unary | `RecordEventRequest` → `RecordEventResponse` |
|  | `RecordLints` | unary | `RecordLintsRequest` → `RecordLintsResponse` |
|  | `RecordObservabilityData` | unary | `RecordObservabilityDataRequest` → `RecordObservabilityDataResponse` |
|  | `SaveMediaAsArtifact` | unary | `SaveMediaAsArtifactRequest` → `SaveMediaAsArtifactResponse` |
|  | `SaveScreenRecording` | unary | `SaveScreenRecordingRequest` → `SaveScreenRecordingResponse` |
|  | `SendAudioChunk` | unary | `SendAudioChunkRequest` → `SendAudioChunkResponse` |
|  | `StartScreenRecording` | unary | `StartScreenRecordingRequest` → `StartScreenRecordingResponse` |
|  | `StreamAudioTranscription` | → server-stream | `StartAudioTranscriptionRequest` → `StreamAudioTranscriptionResponse` |

### Jetbox / State (4)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `JetboxDeleteSummary` | unary | `JetboxDeleteSummaryRequest` → `JetboxDeleteSummaryResponse` |
|  | `JetboxGetLatestVersion` | unary | `JetboxGetLatestVersionRequest` → `JetboxGetLatestVersionResponse` |
|  | `JetboxSubscribeToSummaries` | → server-stream | `JetboxSubscribeToSummariesRequest` → `JetboxSubscribeToSummariesResponse` |
|  | `JetboxWriteSummary` | unary | `JetboxWriteSummaryRequest` → `JetboxWriteSummaryResponse` |

### Telemetry / Debug / Lifecycle (7)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `CaptureConsoleLogs` | unary | `CaptureConsoleLogsRequest` → `CaptureConsoleLogsResponse` |
|  | `DumpPprof` | unary | `DumpPprofRequest` → `DumpPprofResponse` |
|  | `Exit` | unary | `ExitRequest` → `ExitResponse` |
|  | `GetDebugDiagnostics` | unary | `GetDebugDiagnosticsRequest` → `GetDebugDiagnosticsResponse` |
|  | `Heartbeat` | unary | `HeartbeatRequest` → `HeartbeatResponse` |
|  | `Restart` | unary | `RestartRequest` → `RestartResponse` |
|  | `SimulateSegFault` | unary | `SimulateSegFaultRequest` → `SimulateSegFaultResponse` |

### Other (14)

| New | Method | Kind | I/O |
|:-:|---|---|---|
|  | `ForceBackgroundResearchRefresh` | unary | `ForceBackgroundResearchRefreshRequest` → `ForceBackgroundResearchRefreshResponse` |
| 🆕 | `GetCapabilities` | unary | `GetCapabilitiesRequest` → `GetCapabilitiesResponse` |
|  | `GetLoadCodeAssist` | unary | `GetLoadCodeAssistRequest` → `GetLoadCodeAssistResponse` |
|  | `GetPatchAndCodeChange` | unary | `GetPatchAndCodeChangeRequest` → `GetPatchAndCodeChangeResponse` |
|  | `GetProfileData` | unary | `GetProfileDataRequest` → `GetProfileDataResponse` |
|  | `GetRevertPreview` | unary | `GetRevertPreviewRequest` → `GetRevertPreviewResponse` |
|  | `GetTokenBase` | unary | `GetTokenBaseRequest` → `GetTokenBaseResponse` |
|  | `ImportFromCursor` | unary | `ImportFromCursorRequest` → `ImportFromCursorResponse` |
|  | `ListPages` | unary | `ListPagesRequest` → `ListPagesResponse` |
|  | `ListProfiles` | unary | `ListProfilesRequest` → `ListProfilesResponse` |
|  | `MigrateApiKey` | unary | `MigrateApiKeyRequest` → `MigrateApiKeyResponse` |
|  | `RegisterInteraction` | unary | `RegisterInteractionRequest` → `RegisterInteractionResponse` |
|  | `SetupUniversitySandbox` | unary | `SetupUniversitySandboxRequest` → `SetupUniversitySandboxResponse` |
|  | `WellSupportedLanguages` | unary | `WellSupportedLanguagesRequest` → `WellSupportedLanguagesResponse` |
