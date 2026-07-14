# Change Log

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
