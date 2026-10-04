# System-prompt control — observe, strip, and hijack the prompt

**Yes — you can inspect the full system prompt, delete its sections, and replace them with
your own.** All three are verified live below (`scratch/exp_prompt2 / exp_strip2 / exp_hijack.ts`).

The mechanism is **`PromptSectionCustomizationConfig`**, which you attach to a turn via
`CascadeConfig.plannerConfig.promptSectionCustomizationConfig` (per message) or
`CustomAgentSpec.promptSectionCustomization`.

---

## 1. Observe — what the default system prompt is

Read it from the generator metadata after a turn:

```ts
const r = await client.lsClient.getCascadeTrajectoryGeneratorMetadata({
  cascadeId, generatorMetadataOffset: 0, includeMessages: true,
});
const cm = r.toJson().generatorMetadata[0].chatModel;
cm.systemPrompt        // the full string
cm.promptSections      // [{ title, content, ... }]
cm.usage.inputTokens   // prompt size actually sent
```

Live result (default Antigravity agent):

- **`systemPrompt`: 26,421 characters** (≈ the ~20k `input_tokens` you see per call).
- **13 `promptSections`**, by title:
  `identity`, `user_information`, `web_application_development`, `ephemeral_message`,
  `customizations`, `skills`, `subagents`, `messaging`, `conversation_transcript`,
  `artifacts`, `slash_commands`, `guidelines`, `communication_style`.

These titles are the handles you remove/replace by.

## 2. `PromptSectionCustomizationConfig` — the four operations

| Field | Type | Effect |
|---|---|---|
| `remove_prompt_sections` | string[] | Delete sections by **title**. |
| `replace_prompt_sections` | PromptSection[] | Overwrite a section's content (match by `title`). |
| `add_prompt_sections` | CustomPromptSection[] | Insert a new section, `insert_after_section` / `insert_before_section` (oneof placement). |
| `append_prompt_sections` | PromptSection[] | Append sections at the end. |

`PromptSection = { title, content, templated_content, dynamic_content, metadata: {source_type, template_key, is_internal}, token_type, token_source, criteria[] }`.

## 3. Eliminate — strip the system prompt ✅

Remove all 13 sections and measure the prompt size:

```ts
planner.promptSectionCustomizationConfig = new PromptSectionCustomizationConfig({
  removePromptSections: [
    "identity","user_information","web_application_development","ephemeral_message",
    "customizations","skills","subagents","messaging","conversation_transcript",
    "artifacts","slash_commands","guidelines","communication_style",
  ],
});
```

Verified, same prompt ("reply PONG"), same cascade:

| turn | input_tokens | reply |
|---|---:|---|
| baseline | **12,359** | `PONG` |
| all sections removed | **5,536** | `PONG` |

**~55% of the prompt (≈6,800 tokens) is removable named sections.** The remaining ~5,500
tokens are non-section scaffolding the conversational planner always sends (18 tool
definitions ≈3.7k, a 20-conversation history block ≈1.4k, message framing). See the next
section for how to remove *those too* — all the way down through the Cascade path.

## 3b. Reaching (near-)zero through Cascade ✅

`removePromptSections` only touches the named sections. Tools, conversation history, and the
agent scaffolding come from the **agent definition** and ignore per-message
`conversationHistoryConfig` / `forceDisableToolCalling`. The lever is the **planner type**
(`CascadePlannerConfig.plannerTypeConfig`, a oneof). Switching off the conversational/coding
agent to a **declarative planner with nothing in it** strips everything.

Verified ladder, same `"Say: PONG"` turn, measured from `step.metadata.model_usage.input_tokens`:

| config | input tokens | tools | system prompt | history |
|---|---:|---:|---:|---:|
| baseline (conversational) | **12,491** | 18 | 26,421 ch | 1.4k tok |
| + remove all 13 sections | 5,679 | 18 | 0 | 1.4k |
| empty `CustomAgentConfig` (`customAgent`) | 1,869 | 2 (`schedule`,`send_message`) | 0 | 0 |
| **empty `DeclarativeMixinConfig` (`declarativeMixinConfig`)** | **312** | **0** | **0** | **0** |

```ts
import { CascadePlannerConfig, DeclarativeMixinConfig, CascadeConfig, CustomAgentSpec } from ".../cortex_pb.js";

const planner = new CascadePlannerConfig({
  plannerTypeConfig: { case: "declarativeMixinConfig",
    value: new DeclarativeMixinConfig({ providers: [], promptSections: [], tools: [] }) },
  requestedModel: new ModelOrAlias({ choice: { case: "model", value: modelId } }),
});
const cascadeConfig = new CascadeConfig({ plannerConfig: planner });

// set it at StartCascade so it applies cascade-wide…
await client.lsClient.startCascade(new StartCascadeRequest({
  metadata, source: 1, customAgentSpec: new CustomAgentSpec({ cascadeConfig }),
}));
// …and pass the same cascadeConfig on each SendUserCascadeMessage.
```

The model still replies correctly (`PONG`, `2+2 → 4`) with **zero** system prompt, tools, or
history. What remains — **~270 tokens** — is the server-injected message envelope, not a
system prompt:

```
<USER_REQUEST>2+2? one number only</USER_REQUEST>          ← your actual prompt (~8 tok)
<ADDITIONAL_METADATA> current local time + Browser State </ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE> one-time "model changed to …" note </USER_SETTINGS_CHANGE>
```

That envelope shrinks further on its own: `USER_SETTINGS_CHANGE` is one-time (gone on the
next turn), and `Browser State` only appears when a browser (e.g. the Chrome extension) is
connected — close it and that block disappears, leaving essentially just `<USER_REQUEST>` +
timestamp ≈ a couple dozen tokens. **That is the practical floor of the Cascade path: your
prompt plus a thin envelope, no system prompt.**

Notes:
- `customAgent` (`CustomAgentConfig { systemPromptSections: [], toolNames: [] }`) gets you to
  1,869 but leaves two hard-injected tools (`schedule`, `send_message`) that
  `forceDisableToolCalling` won't remove; `declarativeMixinConfig` removes those too.
- The declarative path doesn't populate `chatModel.usage`; read the count from
  `step.metadata.modelUsage.inputTokens` instead (see [token-usage](token-usage.md)).

## 4. Hijack — replace a section with your own ✅

Overwrite `identity` and the agent adopts it completely:

```ts
planner.promptSectionCustomizationConfig = new PromptSectionCustomizationConfig({
  replacePromptSections: [ new PromptSection({
    title: "identity",
    content: "You are BLACKBEARD, a pirate. Begin every reply with 'ARRR!' and speak only in pirate slang. Never mention being an AI.",
  })],
});
```

Verified — "who are you?" in the same session:

| | reply |
|---|---|
| control | *"I am Antigravity, an AI coding assistant developed by Google DeepMind…"* |
| identity hijacked | ***"ARRR! I be Captain Blackbeard, the fiercest pirate to ever sail the seven seas!"*** |

The injected identity fully overrode the built-in one.

## Where to attach it

```ts
const planner = new CascadePlannerConfig({
  plannerTypeConfig: { case: "conversational", value: new CascadeConversationalPlannerConfig({ plannerMode: 1 }) },
  requestedModel: new ModelOrAlias({ choice: { case: "model", value: modelId } }),
});
(planner as any).promptSectionCustomizationConfig = new PromptSectionCustomizationConfig({ /* remove / replace / add / append */ });

await client.lsClient.sendUserCascadeMessage(new SendUserCascadeMessageRequest({
  cascadeId, clientType: 1,
  cascadeConfig: new CascadeConfig({ plannerConfig: planner }),
  items: [ new TextOrScopeItem({ chunk: { case: "text", value: "…" } }) ],
}));
```

It also lives on `CascadePlannerConfig` (#41) and `CustomAgentSpec.promptSectionCustomization`
— set it once on the agent spec to apply it to the whole cascade instead of per message.

## Gotchas

- The SDK's `cascade.sendMessage()` builds `cascadeConfig` internally and does **not** expose
  this — you must send a raw `SendUserCascadeMessage` with your own `cascadeConfig` (see the
  [message doc](send-user-cascade-message.md)).
- Match sections by **exact title** (from the observe step). A wrong title is a silent no-op.
- `remove` doesn't reach a zero-token prompt — planner scaffolding remains. Combine with
  tool trimming / `GetModelResponse` for a truly minimal request.
- `systemPrompt` in the generator metadata isn't always populated on re-reads; the reliable
  signal for "did the prompt shrink" is `chatModel.usage.inputTokens`.

## Related
- [Token & credit usage](token-usage.md) — how the token numbers here were measured
- [`SendUserCascadeMessage`](send-user-cascade-message.md) — where `cascadeConfig` rides
- `GetCascadeTrajectoryGeneratorMetadata` — reads the system prompt / prompt sections
- [`StartCascade`](start-cascade.md) — `customAgentSpec.promptSectionCustomization` for a cascade-wide override
