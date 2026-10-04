# `StreamCascadeReactiveUpdates` — and the stream the SDK actually uses

**Service:** `LanguageServerService` · **Kind:** `→ server-stream` · **I/O:** `StreamReactiveUpdatesRequest → StreamReactiveUpdatesResponse`

> ⚠️ **Deprecated on the server.** Subscribing returns
> `[unknown] reactive state is deprecated`. *(verified live — `scratch/exp_reactive.ts`.)*
> The SDK does **not** use this method. For real-time cascade output, use
> **`StreamAgentStateUpdates`**, documented below — it's what `Cascade.listen()` runs.

This page covers three things: (1) the deprecated reactive-diff protocol these methods were
built on, (2) the live replacement `StreamAgentStateUpdates`, and (3) how the SDK turns its
frames into events.

---

## 1. The reactive family (deprecated)

Four methods share the generic reactive-component protocol
(`StreamReactiveUpdatesRequest → StreamReactiveUpdatesResponse`):

| Method | Live status *(verified)* |
|---|---|
| `StreamCascadeReactiveUpdates` | ❌ `reactive state is deprecated` |
| `StreamCascadeSummariesReactiveUpdates` | ❌ `Summaries reactive state is deprecated` |
| `StreamCascadePanelReactiveUpdates` | ❌ `unimplemented` |
| `StreamUserTrajectoryReactiveUpdates` | (reactive family; treat as deprecated) |

> Note: the SDK's `client.getSummariesStream()` calls the deprecated summaries variant, so
> it currently errors against a live LS — prefer `GetAllCascadeTrajectories` for listing.

### Request — `StreamReactiveUpdatesRequest`
| # | field | type | notes |
|---:|---|---|---|
| 1 | `protocol_version` | uint32 | The SDK sent `1`. |
| 2 | `id` | string | Reactive **component id** to subscribe to (e.g. `"summaries"`, or a cascade id). |
| 3 | `subscriber_id` | string | Caller's subscription id. **Must be unique** — a duplicate id gets `subscription closed by repeat id`. *(verified)* |

### Response — `StreamReactiveUpdatesResponse` (the diff protocol)
A **versioned, field-level protobuf patch** you apply to a local object:

```
StreamReactiveUpdatesResponse { version: uint64, diff: MessageDiff }
MessageDiff.field_diffs[] = FieldDiff {
  field_number: uint32,
  oneof diff:
    update_singular: SingularValue   // any scalar, enum, or recursive message_value: MessageDiff
    update_repeated: RepeatedDiff     // { new_length, update_values[], update_indices[] }
    update_map:      MapDiff          // { map_key_diffs[] }
    clear:           bool
}
```

`SingularValue.message_value` is itself a `MessageDiff`, so the patch is recursive — the
server streams incremental changes and the client mutates its copy field by field. The SDK
implements the applier in [`src/reactive/apply.ts`](../../src/reactive/apply.ts)
(`applyMessageDiff(target, diff, MessageType)`), keyed by `field_number` → `field.localName`,
handling oneof/repeated/map/clear. It's a neat generic sync mechanism — just no longer the
path the server serves cascade state on.

---

## 2. `StreamAgentStateUpdates` — the live replacement ✅

**I/O:** `StreamAgentStateUpdatesRequest → StreamAgentStateUpdatesResponse` (`exa.jetski_cortex_pb`) ·
`→ server-stream`. This is what `CascadeStreamHandler.listen()` subscribes to.

### Request — `StreamAgentStateUpdatesRequest`
| # | field | type | notes |
|---:|---|---|---|
| 1 | `conversation_id` | string | The cascade id to watch. |
| 2 | `subscriber_id` | string | **Unique per subscription.** The SDK uses the cascade id; a second subscriber with the same id kills the first (`subscription closed by repeat id`). Use a distinct suffix if you subscribe alongside the SDK. *(verified)* |
| 4 | `trajectory_verbosity` | enum `ClientTrajectoryVerbosity` | `UNSPECIFIED=0`, `DEBUG=1`, `PROD_UI=2`, `FULL=3`. The SDK sends `FULL=3`. |
| 3 | `initial_steps_page_bounds` | `Slice {start_index, end_index_exclusive}` | Page the initial step backfill. |
| 5/6 | `initial_generator/executor_metadatas_page_bounds` | `Slice` | Page metadata backfill. |
| 7 | `disable_rehydration` | bool | Skip the initial full-state replay. |
| 8 | `enable_latency_telemetry` | bool | |

### Response — `StreamAgentStateUpdatesResponse`
Wraps `update: AgentStateUpdate`:

| # | field | type | notes |
|---:|---|---|---|
| 1 | `conversation_id` | string | |
| 2 | `trajectory_id` | string | Needed to answer interactions (`HandleCascadeUserInteraction`). |
| 3 | `status` | enum `CascadeRunStatus` | `UNSPECIFIED=0`, `IDLE=1`, `RUNNING=2`, `CANCELING=3`, `BUSY=4`. |
| 4/5 | `executable_status` / `executor_loop_status` | enum `CascadeRunStatus` | finer-grained sub-states. |
| 6 | `executor_metadata` | `ExecutorMetadata` | rich run metrics: `termination_reason`, invocation counts, `segment_records`/`trajectory_records` (MetricsRecord), `cascade_config`, snapshots, `execution_error`. |
| 7 | `main_trajectory_update` | `TrajectoryUpdate` | **the important one** — see below. |

`TrajectoryUpdate.steps_update = StepsUpdate`:

| # | field | type | notes |
|---:|---|---|---|
| 1 | `indices` | uint32[] | which step slots this frame updates. |
| 2 | `steps` | `Step[]` | parallel to `indices` — `steps[i]` goes to slot `indices[i]`. |
| 3 | `total_length` | uint32 | full step count so far. |
| 4 | `page_bounds` | `Slice` | which window this covers. |

(Plus `generator_metadatas_update`, `executor_metadatas_update`, `trajectory_type`, and
`metadata: CortexTrajectoryMetadata` with workspaces, parent/root conversation ids, subagent spec.)

### Observed frame behaviour *(verified — `scratch/exp_agentstate.ts`)*

One short turn ("reply HI") produced **34 frames**:

```
frame#1  status=IDLE     idx=[]  total=0            ← initial snapshot
--- send ---
frame#2  status=RUNNING  idx=[]                     ← status flip
frame#3  status=RUNNING  idx=[0] total=1  userInput
frame#5  status=RUNNING  idx=[1] total=2  conversationHistory
frame#6..8 idx=[1]  ← same slot re-sent as it fills in
frame#9  idx=[2] total=3  plannerResponse
frame#10..  idx=[2]  ← plannerResponse streamed token-by-token, same slot each delta
```

Key takeaways:
- Updates are **sparse and index-addressed**: apply `steps[indices[i]] = steps[i]` (exactly
  what `CascadeStreamHandler` does), don't assume append-only.
- A streaming step (planner text, thinking) arrives as **many frames on the same index** —
  that's where the SDK computes text/thinking deltas.
- `status` transitions (IDLE→RUNNING→IDLE) are your turn-boundary signal.

---

## 3. How the SDK consumes it

```
StreamAgentStateUpdates frames
  → CascadeStreamHandler.listen()          // src/core/cascade/stream-handler.ts
      hydrate: state.status, state.trajectory.steps[idx]=step, trajectory.trajectoryId
  → onUpdate(state)
  → CascadeEventParser                      // diff vs previous state
  → Cascade emits ~130 typed events         // text, thinking, statusChange, step:*, interaction…
```

You almost never call any of this directly — `client.startCascade()` wires it up and you
just `cascade.on(Cascade.Events.Text, …)`. Subscribe raw only to observe frames (use a
**unique `subscriber_id`** so you don't evict the SDK's own subscription).

## Gotchas
- **`StreamCascadeReactiveUpdates` is dead** — it throws `reactive state is deprecated`. Use
  `StreamAgentStateUpdates`.
- **`subscriber_id` must be unique.** Duplicates → `subscription closed by repeat id`, which
  kills the earlier subscription (including the SDK's).
- Step updates are **index-addressed, not appended**, and streaming steps repeat the same
  index across many frames.
- `getSummariesStream()` in the SDK hits the deprecated summaries stream; use
  `GetAllCascadeTrajectories` to list cascades instead.

## Related
- [`StartCascade`](start-cascade.md) · [`SendUserCascadeMessage`](send-user-cascade-message.md)
- `HandleCascadeUserInteraction` — needs `trajectory_id` from these frames
- `GetCascadeTrajectory` / `GetCascadeTrajectorySteps` — pull history instead of streaming
