# `StartCascade`

**Service:** `LanguageServerService` · **Kind:** `unary` · **I/O:** `StartCascadeRequest → StartCascadeResponse`

Opens a new **Cascade** — a fresh agent conversation/trajectory on the Language Server —
and returns its `cascadeId`. Everything else in the agent loop (`SendUserCascadeMessage`,
the reactive update streams, interaction approvals) hangs off the id this returns.

This is the single most configurable entry point in the API: the request carries the
workspace roots, the model, the trajectory type, and an optional **`CustomAgentSpec`**
that lets you sandbox the agent, swap its toolset, inject MCP servers, and rewrite its
prompt sections.

---

## What it does

- Allocates a new trajectory on the LS and returns `cascadeId` (a UUID).
- Does **not** send a user message — it only opens the session. Follow with
  `SendUserCascadeMessage` (or `cascade.sendMessage(...)`).
- Nothing streams yet; you subscribe separately via `StreamCascadeReactiveUpdates`
  (the SDK's `Cascade` does this for you in `listen()`).

## When to use it

- Starting any agent interaction. In the SDK you almost always use the convenience
  wrapper `client.startCascade()` instead of calling this raw.
- Call it raw (`client.languageServer.startCascade(req)`) when you need to set fields the
  wrapper doesn't expose yet — a specific `requestedModel`, `workspaceUris`, a
  `customAgentSpec` (sandbox / research-only), or a `trajectoryType`.

## Request — `StartCascadeRequest`

| Field | Type | Notes |
|---|---|---|
| `metadata` | `Metadata` | Required. Auth/IDE identity (apiKey, ideName, extension…). The SDK fills this in. |
| `source` | `CortexTrajectorySource` | Required. Use `CASCADE_CLIENT` (= `1`) for SDK use. |
| `trajectoryType` | `CortexTrajectoryType` | Defaults to the mainline cascade. `CASCADE = 4` for a normal agent run; other values drive special modes (checkpoint, browser, LLM-judge…). |
| `requestedModel` | `Model` | Model by numeric id/enum. Omit to use the server default. Resolve names via `GetAvailableModels`. |
| `workspaceUris` | `string[]` | `file://` roots the agent may read. |
| `overrideWorkspaceUris` | `string[]` | Replace (not extend) the active workspace set. |
| `cascadeId` | `string` | Supply to reuse a specific id; omit to let the server allocate. |
| `parentConversationId` | `string` | Fork/nest under an existing conversation. |
| `customAgentSpec` | `CustomAgentSpec` | The big one — see below. |
| `projectEnvConfig` | `ProjectEnvironmentConfig` | Project/runtime environment binding. |
| `agentPath` | `string` | 🆕 (2.5.5) Path to a custom agent definition. |
| `activeProfile` | `string` | Named profile to run under. |
| `tags` | `string[]` | Free-form tags on the trajectory. |
| `agentScriptItem` | `AgentScriptItem` | Preloaded agent script. |
| `experimentConfig` | `ExperimentConfig` | Per-cascade experiment overrides. |

### `CustomAgentSpec` highlights

Constrain or reshape the agent for this cascade:

| Field | What it controls |
|---|---|
| `commandExecutionPolicy` | e.g. research-only vs. allow-exec. |
| `enforcedWorkspaceValidation` | Hard-limit file access to the given workspace. |
| `workspacePaths` / `userActiveWorkspaces` | Which roots are in scope. |
| `mcpServers` / `launchedMcpServers` | Inject MCP servers for this run. |
| `customTools` / `skipMcpPrefixes` | Swap/trim the toolset. |
| `skills` / `agents` / `customAgent` / `builtinAgent` | Pick the agent persona/skills. |
| `cascadeConfig` | Deep planner/executor limits override. |
| `promptSectionCustomization` | Rewrite prompt sections. |

## Response — `StartCascadeResponse`

| Field | Type | Notes |
|---|---|---|
| `cascadeId` | `string` | The new trajectory id. Feed it to every subsequent call. |

## SDK access

```ts
// Convenience wrapper (recommended) — builds metadata + source, subscribes to updates:
const cascade = await client.startCascade();
console.log(cascade.id);              // the cascadeId
await cascade.sendMessage("Refactor foo.ts");

// Raw facade call — full control over the request:
const { cascadeId } = await client.languageServer.startCascade({
  metadata,
  source: 1,                          // CASCADE_CLIENT
  trajectoryType: 4,                  // CASCADE
  requestedModel: 42 as any,          // numeric model id
  workspaceUris: ["file:///path/to/project"],
});
```

### Sandboxed / research-only example

```ts
const { cascadeId } = await client.languageServer.startCascade({
  metadata,
  source: 1,
  customAgentSpec: {
    enforcedWorkspaceValidation: true,
    workspacePaths: { paths: ["file:///path/to/project/examples"] },
    commandExecutionPolicy: "research_only",
  },
});
```
*(verified against `test/test_sandbox_config.ts` and `test/test_cascade_config.ts`)*

## Gotchas

- **`metadata` is required** and easy to forget on raw calls — without valid auth the LS
  rejects the request. The `startCascade()` wrapper hard-codes IDE identity for you.
- `oneof` and nested-message fields (`customAgentSpec`, `cascadeConfig`) need the exact
  `{ case, value }` / object shape. Use the mock generator to get typed boilerplate:
  `npx tsx scripts/mock_gen.ts startCascade customAgentSpec`.
- Returns immediately with just an id — no work has started. Send a message and subscribe
  to updates to see anything happen.
- `requestedModel` is a numeric id/enum, not a name string. Map names→ids via
  `GetAvailableModels` (or the SDK's `resolveModelId`).

## Related

- [`SendUserCascadeMessage`](INDEX.md) — send a turn into the cascade
- `StreamCascadeReactiveUpdates` — subscribe to state/events
- `HandleCascadeUserInteraction` — approve/deny agent actions
- `StartBattleMode` — fork the cascade into competing arms
- `GetCascadeTrajectory` — read the full history
