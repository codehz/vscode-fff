# Change Log

## [0.2.1]

- Tool results attach Chat expandable `toolResultDetails` (file / location list) when fff output can be parsed
- `pastTenseMessage` / `toolResultMessage` used only when `chatParticipantPrivate` is available (dev host / allowlisted builds)

## [0.2.0]

- **Breaking:** Remove `workspaceFolder` from all tool inputs (single-root optimized; always uses the first enabled workspace folder)
- **Breaking:** `grep` now takes `pattern` + optional `constraints` instead of a single combined `query`
- `find_files` adds optional `constraints` separate from `query` (same explicit-parameter style as `multi_grep`)
- Drop multi-root folder-hint resolution (`resolveWorkspaceFolder`) from the tool path

## [0.1.1]

- Documentation / packaging follow-ups for native LM tools

## [0.1.0]

- **Breaking:** Stop exposing FFF via `mcpServerDefinitionProviders`
- Register native language model tools: `grep`, `find_files`, `multi_grep` (`#grep`, `#find_files`, `#multi_grep`)
- Spawn `fff-mcp` internally and forward tool calls over NDJSON MCP JSON-RPC
- Custom chat `invocationMessage` instead of raw MCP JSON presentation
- Optional `workspaceFolder` input for multi-root workspaces
- Command renamed to **FFF: Show Status**

## [0.0.1]

- Register workspace-scoped `fff-mcp` via `mcpServerDefinitionProviders`
- Always pass the current workspace folder as the index root
- Settings for binary path, extra args, db/log paths, and max cached files
- Command: **FFF: Show MCP Server Status**
