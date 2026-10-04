# Token & credit usage — reading what a turn consumed

**Yes, per-call token usage is available**, and you already have it: every trajectory `Step`
carries `metadata: CortexStepMetadata`, and its `model_usage` field is a full token breakdown.
No extra RPC needed — the steps you receive over `StreamAgentStateUpdates` (i.e. what the SDK
stores in `cascade.state.trajectory.steps`) already contain it. *(verified live — `scratch/exp_tokens.ts`.)*

---

## Where it lives

```
Step (trajectory_pb)
└─ metadata: CortexStepMetadata            // field #5 on every step
   ├─ model_usage: ModelUsageStats         // ← the token counts
   │   ├─ model:                 enum Model
   │   ├─ input_tokens:          uint64
   │   ├─ output_tokens:         uint64
   │   ├─ thinking_output_tokens:uint64
   │   ├─ response_output_tokens:uint64
   │   ├─ cache_read_tokens:     uint64
   │   └─ cache_write_tokens:    uint64
   ├─ model_cost:          float           // $ cost, when populated
   ├─ flow_credits_used:   int32
   ├─ prompt_credits_used: int32
   ├─ tool_call_output_tokens: int32
   └─ retry_infos[].{ usage: ModelUsageStats, consumed_credits: Credits[] }
```

`Credits = { credit_type: enum CreditType, credit_amount: int64, minimum_credit_amount_for_usage }`.

## Reading it (verified)

```ts
const cascade = await client.startCascade();
await cascade.run("Write a haiku about TypeScript.");

let inTok = 0n, outTok = 0n, thinkTok = 0n, cacheR = 0n;
for (const s of cascade.state.trajectory?.steps ?? []) {
  const mu = (s as any).metadata?.modelUsage;
  if (!mu) continue;
  inTok    += mu.inputTokens          ?? 0n;
  outTok   += mu.outputTokens         ?? 0n;
  thinkTok += mu.thinkingOutputTokens ?? 0n;
  cacheR   += mu.cacheReadTokens      ?? 0n;
}
console.log({ inTok, outTok, thinkTok, cacheR });
```

Live result for a one-line haiku prompt:

| step | model | input | output | thinking | cost | credits |
|---|---|---:|---:|---:|---:|---:|
| `plannerResponse` | 1072 | 19,901 | 585 | 568 | 0 | 0 |
| `checkpoint` | 1050 | 35 | 4 | 0 | 0 | 0 |
| **total** | | **19,936** | **589** | **568** | 0 | 0 |

Notes:
- Token fields are `uint64` → they come back as **BigInt** in JS. Sum with `0n`, not `0`.
- The big `input_tokens` (~20k for a haiku) is the system prompt + context window, not your
  message text — it's the real prompt size sent to the model.
- `model` is the numeric `Model` enum id (map to a name via `GetAvailableModels`).
- `model_cost` / `flow_credits_used` / `prompt_credits_used` were **0** on this account/model
  even though tokens were counted — cost/credit population appears model/plan-dependent. Treat
  `model_usage` tokens as the reliable signal and credits as best-effort.

## Other sources

- **`ChatModelMetadata.usage`** (same `ModelUsageStats`) — delivered in the *generator*
  metadata (`CortexStepGeneratorMetadata.chat_model`) that `StreamAgentStateUpdates` streams
  with `trajectory_verbosity = FULL`, and fetchable via
  **`GetCascadeTrajectoryGeneratorMetadata`**. Also carries `credit_cost`, `consumed_credits`,
  `time_to_first_token`, `streaming_duration` — good for latency/cost dashboards.
- **`ContextWindowMetadata.estimated_tokens_used`** + `token_breakdown: TokenBreakdown`
  (`total_tokens`) — context-window pressure, not per-call spend.
- **Account credits (not tokens):** [`RetrieveUserQuotaSummary`](INDEX.md) returns balances —
  live example: `Prompt Credits 500/50000`, `Flow Credits 100/150000`. Use this for
  remaining-quota, not per-turn accounting.

## Gotchas

- Usage is **per step**, and one turn has several steps (userInput, planner, checkpoint…).
  Only steps that made an LLM call have `model_usage`. Sum across steps for a turn total.
- `model_usage` populates as the step completes; read it after the turn goes `idle`
  (`waitForTurnComplete()` / after `cascade.run()`), not mid-stream.
- BigInt everywhere in the token fields.

## Related
- [`StreamCascadeReactiveUpdates`](stream-cascade-reactive-updates.md) — how steps (with this
  metadata) arrive
- `GetCascadeTrajectoryGeneratorMetadata` / `GetCascadeTrajectoryExecutorMetadatas` — pull
  generator/executor metadata explicitly
- `RetrieveUserQuotaSummary` — account credit balances
