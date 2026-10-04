# Reference dump — default Antigravity agent prompt

A point-in-time capture of the **full, unmodified** system prompt, tool set, and message
envelope the default Antigravity coding agent sends to the model. Kept for reference (e.g.
when diffing after an IDE update, or building custom agents / [prompt overrides](../system-prompt-control.md)).

**Captured:** 2026-09-06 · Antigravity IDE 2.5.5 · model `MODEL_PLACEHOLDER_M73` (Gemini 3.6 Flash) ·
default `startCascade()` + one turn, read via `GetCascadeTrajectoryGeneratorMetadata(includeMessages: true)`.
**Size:** system prompt **31,187 chars** / **~20,617 input tokens** · 12 sections · 18 tools · 3 envelope messages.

> Point-in-time and environment-specific: the capture contains this machine's absolute
> workspace paths, App Data Directory, and a conversation id. Prompt/section/tool contents
> shift between IDE versions and model routes — re-dump with `scratch/dump_full.ts` to refresh.

## Files

| File | What |
|---|---|
| [`default-system-prompt.txt`](default-system-prompt.txt) | The full system prompt, verbatim (all 12 sections concatenated, `<tag>`-delimited). |
| [`default-tools.json`](default-tools.json) | The 18 tool definitions sent to the model. |
| [`default-message-envelope.json`](default-message-envelope.json) | The 3 message prompts (USER_REQUEST wrapper + metadata, conversation-history block, prior step). |

## System-prompt sections (in order)

| # | section | chars | gist |
|---:|---|---:|---|
| 1 | `identity` | 721 | "You are Antigravity… pair programming with a USER." |
| 2 | `user_information` | 733 | OS, active workspaces + CorpusName mapping, App Data Dir, conversation id. |
| 3 | `web_application_development` | 4,176 | Web stack rules, design-aesthetics mandate, build workflow. |
| 4 | `customizations` | 2,944 | User rules / customization framework. |
| 5 | `skills` | 1,676 | Skills system. |
| 6 | `subagents` | 2,014 | Subagent orchestration. |
| 7 | `messaging` | 868 | How to message the user. |
| 8 | `conversation_transcript` | 3,302 | Transcript format / step conventions. |
| 9 | `artifacts` | 6,151 | Artifacts system (largest section). |
| 10 | `slash_commands` | 1,583 | Slash-command handling. |
| 11 | `guidelines` | 5,584 | Core behavioral guidelines. |
| 12 | `communication_style` | 1,424 | Tone / formatting rules. |

> An `ephemeral_message` section (~variable) also appears in some turns; it wasn't present in
> this capture. Section **titles** are the handles you pass to `removePromptSections` /
> `replacePromptSections` — see [system-prompt-control](../system-prompt-control.md).

## Tools (18) sent to the model

| tool | bytes | | tool | bytes |
|---|---:|---|---|---:|
| `ask_question` | 2,732 | | `multi_replace_file_content` | 6,285 |
| `browser_subagent` | 4,043 | | `read_url_content` | 1,296 |
| `define_subagent` | 2,170 | | `replace_file_content` | 4,799 |
| `generate_image` | 2,216 | | `run_command` | 3,194 |
| `grep_search` | 2,691 | | `schedule` | 5,926 |
| `invoke_subagent` | 3,579 | | `search_web` | 1,044 |
| `list_dir` | 1,408 | | `send_message` | 1,179 |
| `manage_subagents` | 1,616 | | `view_file` | 2,737 |
| `manage_task` | 1,788 | | `write_to_file` | 2,951 |

`schedule` + `send_message` are the two the agent keeps even after `toolNames: []` on a
custom agent (see [system-prompt-control §3b](../system-prompt-control.md)).

## Re-dumping

```bash
npx tsx docs/api/reference/dump-full-prompt.ts   # refreshes default-*.{txt,json} in place
```
Then update the sizes / capture line in this README from the script's console output.
