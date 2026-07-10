# FFF for VS Code

Workspace-scoped [fff-mcp](https://github.com/dmtrKovalenko/fff.nvim) for Copilot Chat and other language-model clients in VS Code.

## Why an extension?

Global / user-level MCP configs for `fff-mcp` often start with no project path, so the server falls back to the process working directory (frequently `$HOME`) and tries to index everything.

This extension registers `fff-mcp` through VS Code's `mcpServerDefinitionProviders` API and **always passes the current workspace folder as the index root**.

## Requirements

- VS Code `1.125+` (or compatible)
- System-installed `fff-mcp` on `PATH` (or configure `fff.binaryPath`)

Install fff-mcp (example):

```bash
curl -fsSL https://raw.githubusercontent.com/dmtrKovalenko/fff.nvim/main/install-mcp.sh | bash
```

## What you get

Each open workspace folder becomes one MCP server labeled `FFF` (or `FFF (<folder>)` in multi-root workspaces). The server exposes the same tools as CLI fff-mcp:

| Tool | Purpose |
|------|---------|
| `grep` | Content search (default) |
| `find_files` | Fuzzy file-name search |
| `multi_grep` | OR search across multiple patterns |

## Settings

| Setting | Scope | Default | Description |
|---------|-------|---------|-------------|
| `fff.enabled` | resource | `true` | Enable FFF MCP for this folder |
| `fff.binaryPath` | machine-overridable | `fff-mcp` | Path to the executable |
| `fff.extraArgs` | resource | `["--no-update-check"]` | Extra args after the workspace path |
| `fff.frecencyDb` | resource | `""` | Optional `--frecency-db` |
| `fff.historyDb` | resource | `""` | Optional `--history-db` |
| `fff.logFile` | resource | `""` | Optional `--log-file` |
| `fff.logLevel` | resource | `""` | Optional `--log-level` |
| `fff.maxCachedFiles` | resource | `null` | Optional `--max-cached-files` |

Example (user or workspace `settings.json`):

```json
{
  "fff.binaryPath": "/usr/bin/fff-mcp",
  "fff.extraArgs": ["--no-update-check", "--no-warmup"],
  "fff.maxCachedFiles": 20000
}
```

## Commands

- **FFF: Show MCP Server Status** — print the resolved command/args/cwd for each provided server.

## Development

```bash
npm install
npm run compile
# F5 → "Run Extension"
```

In the Extension Development Host:

1. Open a project folder.
2. Open Chat (agent mode) and confirm FFF tools appear.
3. Optionally run **FFF: Show MCP Server Status**.

## Notes

- Prefer this extension over a global `fff` entry in user `mcp.json` for project work, so indexing stays on the workspace root.
- Multi-root workspaces get one `fff-mcp` process per enabled folder.
- Child processes are spawned by VS Code (stdio MCP); the extension only supplies definitions.
