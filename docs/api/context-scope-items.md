# Context Scope Items — what you can attach to a message

When you send a turn with [`SendUserCascadeMessage`](send-user-cascade-message.md), each
entry in `items` is a **`TextOrScopeItem`** — a `oneof chunk`:

```
TextOrScopeItem.chunk = { case: "text", value: string }
                      | { case: "item", value: ContextScopeItem }
```

The `"item"` case carries a **`ContextScopeItem`**, itself a `oneof scope_item` with **27
cases** — the full "@-mention" vocabulary. This doc maps every case and its fields, so you
know exactly what information can ride along with a message.

> Two levels of oneof: `TextOrScopeItem.chunk` → `ContextScopeItem.scope_item`.
> Build with `new ContextScopeItem({ scopeItem: { case: "<case>", value: <SubMessage> } })`.
> Get typed boilerplate: `npx tsx scripts/mock_gen.ts sendUserCascadeMessage items`.

Legend: ✅ = delivered-to-model confirmed live · ▫︎ = structural (from descriptor), not
individually run here. Field names are proto snake_case; the TS class uses camelCase.

---

## Files & directories

### `file` / `directory` — `PathScopeItem` ✅ (file verified)
Attach a whole file or directory by URI.

| # | field | type | notes |
|---:|---|---|---|
| 5 | `absolute_uri` | string | **Use this.** `file:///abs/path`. |
| 1 | `absolute_path_migrate_me_to_uri` | string | ⚠️ legacy path form. |
| 2 | `workspace_relative_paths_migrate_me_to_workspace_uris` | map<string,string> | ⚠️ legacy. |
| 6 | `workspace_uris_to_relative_paths` | map<string,string> | workspace-relative addressing. |
| 3 | `num_files` | uint32 | (dir) file count hint. |
| 4 | `num_bytes` | uint64 | size hint. |

*Verified: attaching `README.md` and asking for its H1 returned `# Antigravity Client`.*

### `file_line_range` — `FileLineRange` ▫︎
A specific line span of a file.

| # | field | type |
|---:|---|---|
| 1 | `absolute_uri` | string |
| 2 | `start_line` | uint32 |
| 3 | `end_line` | uint32 |

*Note: in a bare SDK session this started a turn but didn't produce a text reply on its
own — likely needs the file tracked in the active workspace. Prefer `file` or `text_block`
when you just want to hand the model content.*

## Literal & code content

### `text_block` — `TextBlock` ✅
Inject arbitrary literal text as context — no file needed.

| # | field | type | notes |
|---:|---|---|---|
| 1 | `content` | string | the text. |
| 3 | `label` | string | *(oneof identifier)* display label. |
| 2 | `file_line_range` | FileLineRange | *(oneof identifier)* attribute it to a file span instead of a label. |

*Verified: injecting `content:"REMEMBER_TOKEN=Zorp99"` → agent echoed `Zorp99`.*

### `code_context` — `CodeContextItem` ▫︎
A resolved code node (function/class/snippet) with location + language.

| # | field | type | notes |
|---:|---|---|---|
| 16 | `absolute_uri` | string | file. |
| 2 | `workspace_paths` | WorkspacePath[] | `{ workspace_uri, relative_path }`. |
| 3 | `node_name` | string | e.g. the symbol name. |
| 4 | `node_lineage` | string[] | enclosing scope chain. |
| 5/6 | `start_line` / `end_line` | uint32 | |
| 12/13 | `start_col` / `end_col` | uint32 | |
| 7 | `context_type` | enum CodeContextType | |
| 10 | `language` | enum Language | |
| 11 | `snippet_by_type` | map<string,SnippetWithWordCount> | |
| 14 | `repo_info` | GitRepoInfo | see below. |
| 15 | `file_content_hash` | bytes | |

### `cci_with_subrange` — `CciWithSubrange` ▫︎
A `CodeContextItem` (`cci`) plus a byte/offset `subrange`:
`ContextSubrange { snippet_type: enum, start_offset: int64, end_offset: int64 }`.

## Repositories (Git)

`GitRepoInfo` is the shared repo descriptor used in several items:
`{ name, owner, repo_name, commit, version_alias, scm_provider: enum ScmProvider, base_git_url }`.

- ### `repository` — `RepositoryScopeItem` ▫︎ → `{ repo_info: GitRepoInfo }`
- ### `repository_path` — `RepositoryPathScopeItem` ▫︎ → `{ repo_info, relative_path, is_dir }`

## Terminal & console

### `terminal` — `TerminalScopeItem` ▫︎
| # | field | type |
|---:|---|---|
| 1 | `process_id` | string |
| 2 | `name` | string |
| 3 | `last_command` | string |
| 4 | `selectionContent` | string |

### `console_log` — `ConsoleLogScopeItem` ▫︎
`{ lines: ConsoleLogLine[] { timestamp_str, type, output, location }, server_address }`.

## Browser

### `browser_page` — `BrowserPageScopeItem` ▫︎
`{ url, title, visible_text_content, page_id }`

### `browser_text` — `BrowserTextScopeItem` ▫︎
`{ url, visible_text, page_id }`

### `browser_code_block` — `BrowserCodeBlockScopeItem` ▫︎
`{ url, title, code_content, language: enum Language, context_text, page_id }`

### `dom_element` — `DOMElementScopeItem` ▫︎
`{ tag_name, outer_html, id, react_component_name, file_line_range: FileLineRange }`

## Knowledge-base integrations — `KnowledgeBaseScopeItem`

The **same** `KnowledgeBaseScopeItem` shape backs five cases: `slack`, `github`, `jira`,
`google_drive`, `knowledge`. You pick the integration by which oneof case you set.

| # | field | type | notes |
|---:|---|---|---|
| 1 | `document_id` | string | id within the integration. |
| 7 | `index` | enum IndexChoice | which index. |
| 8 | `document_type` | enum DocumentType | |
| 3 | `display_name` | string | |
| 4 | `description` | string | |
| 5 | `display_source` | string | |
| 6 | `url` | string | |

## Rules, recipes, MCP, slash commands

### `rule` — `RuleScopeItem` ▫︎ → `{ rule_path, rule_name, description }`

### `recipe` — `RecipeScopeItem` ▫︎ → `{ recipe_id, title, description, system_prompt, uri }`

### `mcp_resource` — `McpResourceItem` ▫︎ → `{ uri, name, description, mime_type, server_name }`

### `mcp_prompt` — `McpPromptScopeItem` ▫︎
| # | field | type |
|---:|---|---|
| 1 | `server_name` | string |
| 2 | `name` | string |
| 3 | `description` | string |
| 4 | `arguments` | McpPromptArgument[] `{ name, description, required }` |
| 5 | `argument_values` | map<string,string> |
| 6 | `messages` | McpPromptMessage[] `{ role, oneof content: text \| media: Media \| resource: McpResourceContent }` |

### `slash_command` — `SlashCommandScopeItem` ▫︎
`{ info: SlashCommandInfo { name, model_facing_text, type: enum SlashCommandType, icon }, argument_values: map<string,string> }`

## Conversation & activity

### `conversation` — `ConversationScopeItem` ▫︎
`{ id, title, last_modified_time: Timestamp, source }`

### `user_activity` — `UserActivityScopeItem` ▫︎
`{ id, branch, current }`

### `dynamic_context` — `DynamicContextScopeItem` ▫︎
Generic provider-supplied item: `{ provider_label, item_value, item_label, uri }`.

---

## Practical guidance

- **Just want to hand the model content?** Use `text_block` (literal) or `file` (whole
  file) — both verified to work from a bare SDK connection, no IDE needed.
- **Integration items** (`slack`/`github`/`jira`/`google_drive`, `mcp_*`, `browser_*`,
  `terminal`, `conversation`) reference server-side state by id — they resolve best when
  the corresponding source is live (indexed KB, running MCP server, open browser/terminal).
- Ordering matters: put the scope item(s) first and the instruction text last, as the SDK
  examples do, so the model reads the attachment then the ask.

## Related
- [`SendUserCascadeMessage`](send-user-cascade-message.md) — the call these ride on
- `GetMatchingContextScopeItems` — server-side lookup of available scope items
- `SearchCode` / `GetKnowledgeItems` — find ids to reference here
