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

## 📌 Documentation backlog (priority order)

The methods worth accurate, hand-written docs first — chosen for power, non-obviousness,
or because they're new. Checked = done.

### Tier 1 — Core agent loop (the SDK's reason to exist)
- [ ] **`StartCascade`** — open an agent session; the big configurable entry point (workspace, model, custom agent spec, sandbox). → [start-cascade.md](start-cascade.md)
- [ ] **`SendUserCascadeMessage`** — send a user turn into a running cascade
- [ ] **`StreamCascadeReactiveUpdates`** — the reactive state stream the whole event system is built on
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
