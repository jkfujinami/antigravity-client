# `SendUserCascadeMessage`

**Service:** `LanguageServerService` · **Kind:** `unary` · **I/O:** `SendUserCascadeMessageRequest → SendUserCascadeMessageResponse`

Sends a **user turn** into an existing cascade (started by [`StartCascade`](start-cascade.md)).
This is how you actually talk to the agent: plain text, attached context (@-mentions of
files/dirs/terminals/etc.), images, and inline diff/file comments all go through this one call.

> **The response is empty (`{}`).** This RPC only *submits* the turn. Everything the agent
> produces — text, thinking, steps, approvals — arrives on the reactive update stream
> (`StreamCascadeReactiveUpdates`), which the SDK's `Cascade` already listens to. *(verified live)*

---

## What it does

- Appends a user message to the trajectory and kicks the agent for a turn.
- Returns immediately with an empty response; **it is fire-and-forget by default**
  (see `blocking`).
- Content is a list of `items` (text and/or context-scope items), plus optional `media`,
  and comment attachments.

## When to use it

- Every user turn after `StartCascade`. In the SDK, `cascade.sendMessage("text", opts)`
  wraps this and builds the required `cascadeConfig`/model for you.
- Call it raw (`client.lsClient.sendUserCascadeMessage(req)`) when you need context items
  (@-mentions), inline comments, `additionalSteps`/`plannerResponse` injection, or the
  origin/tags/delivery controls that the wrapper doesn't expose.

## Request — `SendUserCascadeMessageRequest`

Field numbers and semantics below were read from the descriptor and **verified with live
experiments** (`scratch/exp_send*.ts`).

| # | Field | Type | Notes |
|---:|---|---|---|
| 1 | `cascadeId` | `string` | **Required.** The id from `StartCascade`. |
| 2 | `items` | `TextOrScopeItem[]` | **The message body.** Each item is either text or a context-scope item — see below. |
| 5 | `cascadeConfig` | `CascadeConfig` | **Carries the model selection.** Omit it and the turn runs but produces *no generation* — verified: empty text without it. The SDK builds a conversational planner config + `requestedModel` here. |
| 14 | `media` | `Media[]` | Images/audio etc. as inline data or URI. The SDK maps `options.images` → `Media`. |
| 8 | `blocking` | `bool` | `false` (default): RPC returns in ~5 ms, work continues async. `true`: RPC waits for the server to accept/begin (~900 ms measured) — it still does **not** block for the whole turn. *(verified)* |
| 11 | `clientType` | `ChatClientRequestStreamClientType` | `IDE=1` (SDK default), `BROWSER=2`, `UNSPECIFIED=0`. |
| 18 | `messageOrigin` | `AgentMessageOrigin` | `UNSPECIFIED=0`, `IDE=1`, `SDK_EXECUTABLE=2`, `SUBAGENT=3`. Cosmetic provenance tag; accepted fine. *(verified)* |
| 22 | `deliveryStrategy` | `MessageDeliveryStrategy` | `UNSPECIFIED=0`, `NEXT_INVOCATION=1`, `WHEN_IDLE=2` — when a message is delivered if the agent is busy. |
| 21 | `tags` | `string[]` | Free-form tags on the message. |
| 16 | `propagateError` | `bool` | Surface server-side errors back to the caller. |
| 9 | `additionalSteps` | `Step[]` | Inject arbitrary trajectory steps alongside the message. |
| 17 | `plannerResponse` | `CortexStepPlannerResponse` | Inject a planner response directly. |
| 20 | `continueAfterInjection` | `bool` | After injecting steps/planner response, keep the agent running. |
| 10 | `artifactComments` | `ArtifactComment[]` | Comments anchored to an artifact. |
| 12 | `fileDiffComments` | `FileDiffComment[]` | Comments on a diff. |
| 13 | `fileComments` | `FileComment[]` | Comments on a file. |
| 19 | `customAgentSpec` | `CustomAgentSpec` | Per-turn agent/sandbox override (same shape as in `StartCascade`). |
| 23 | `activeProfile` | `string` | Named profile. |
| 24 | `userIdentity` | `UserIdentity` | Attribute the turn to a specific user. |
| 25 | `editorState` | `EditorState` | 🆕 Current editor state (open file, selection…) as ambient context. |
| 3 | `metadata` | `Metadata` | **⚠️ Deprecated & optional.** Auth is bound to the connection, not the message — verified: messages succeed with `metadata` omitted entirely. The SDK still sends it for compatibility. |
| 6 | `images` | `ImageData[]` | **⚠️ Deprecated** → use `media`. |
| 4 | `experimentConfig` | `ExperimentConfig` | **⚠️ Deprecated.** |

### `items` — text and context (`TextOrScopeItem`)

`TextOrScopeItem` is a `oneof chunk`:

- `{ case: "text", value: "your text" }` — a plain text chunk.
- `{ case: "item", value: ContextScopeItem }` — an **@-mention / attached context**.

`ContextScopeItem` is a big `oneof scope_item` with **27 cases** — the full @-mention
vocabulary. **See [context-scope-items.md](context-scope-items.md) for every case and all
its fields.** Highlights:

| case | Attaches |
|---|---|
| `textBlock` | A literal `{ content, label }` snippet — verified: agent echoed the injected token. |
| `file` / `directory` | `PathScopeItem { absoluteUri }` — verified: agent read the attached README and returned its H1. |
| `fileLineRange` | A specific line range of a file. |
| `repository` / `repositoryPath` | A repo or path within it. |
| `terminal` / `consoleLog` | Terminal buffer / console output. |
| `browserPage` / `browserText` / `browserCodeBlock` / `domElement` | Browser context. |
| `slack` / `github` / `jira` / `googleDrive` / `knowledge` | Knowledge-base integrations. |
| `rule` / `recipe` / `mcpResource` / `mcpPrompt` / `slashCommand` | Rules, recipes, MCP, slash commands. |

## Response — `SendUserCascadeMessageResponse`

Empty message (`{}`). Observe results on the reactive stream, or use the SDK helpers
`cascade.waitForTurnComplete()` / the return of `cascade.run(...)`.

## SDK access

```ts
// Convenience wrapper (recommended) — builds metadata + cascadeConfig + model for you:
await cascade.sendMessage("Explain this repo", { model: "Gemini_3_Flash" });
await cascade.sendMessage("What's in this screenshot?", {
  images: [{ base64Data, mimeType: "image/png", caption: "err" }],
});

// One-shot: send + wait + collect
const { text, newSteps, finalStatus, timedOut } = await cascade.run("Fix the build");

// Raw facade call with an attached file (@-mention):
await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({
  cascadeId: cascade.cascadeId,
  cascadeConfig,                                 // REQUIRED for a model response
  clientType: 1,                                 // IDE
  items: [
    new TextOrScopeItem({ chunk: { case: "item", value: new ContextScopeItem({
      scopeItem: { case: "file", value: new PathScopeItem({ absoluteUri: "file:///abs/path/README.md" }) },
    })})}),
    new TextOrScopeItem({ chunk: { case: "text", value: "Summarize the attached file." } }),
  ],
}));
```

## Gotchas

- **`cascadeConfig` is effectively required.** It looks optional, but without it the turn
  runs and returns yet the model generates nothing (verified empty text). It's where the
  model id lives. Use `cascade.sendMessage()` unless you build it yourself.
- **The response tells you nothing** — it's `{}`. Subscribe to the stream (the `Cascade`
  does) or await `waitForTurnComplete()`.
- **`blocking: false` is fire-and-forget** — the call returns before the answer exists.
- **`metadata`, `images`, `experimentConfig` are deprecated.** Prefer connection auth,
  `media`, and per-message config respectively.
- Context items are a `oneof scope_item` on `ContextScopeItem`, nested inside the
  `oneof chunk` of `TextOrScopeItem` — two levels of oneof. Use
  `npx tsx scripts/mock_gen.ts sendUserCascadeMessage items` for typed boilerplate.

## Related

- [`StartCascade`](start-cascade.md) — open the session first
- `StreamCascadeReactiveUpdates` — where the actual output arrives
- `HandleCascadeUserInteraction` — approve/deny actions the turn proposes
- `SendAllQueuedMessages` / `WaitForConversationFullyIdle` — queue & idle control
