# FFF for VS Code

Workspace-scoped [fff-mcp](https://github.com/dmtrKovalenko/fff.nvim) search tools for Copilot Chat and other language-model clients in VS Code.

## Why an extension?

Global / user-level MCP configs for `fff-mcp` often start with no project path, so the server falls back to the process working directory (frequently `$HOME`) and tries to index everything.

This extension:

1. Always passes the **current workspace folder** as the index root to `fff-mcp`.
2. Exposes FFF as **native language model tools** (`fff_grep`, `fff_find_files`, `fff_multi_grep`) instead of registering an MCP server in VS Code.

Native tools avoid Copilot’s MCP UI forcing raw tool-call JSON into the chat transcript (which breaks the “N tool calls” collapsible block and wastes space).

## Requirements

- VS Code `1.125+` (or compatible)
- System-installed `fff-mcp` on `PATH` (or configure `fff.binaryPath`)

Install fff-mcp (example):

```bash
curl -fsSL https://raw.githubusercontent.com/dmtrKovalenko/fff.nvim/main/install-mcp.sh | bash
```

## What you get

| Tool | `#` reference | Purpose |
|------|---------------|---------|
| `fff_grep` | `#grep` | Content search (default) |
| `fff_find_files` | `#find_files` | Fuzzy file-name search |
| `fff_multi_grep` | `#multi_grep` | OR search across multiple patterns |

Under the hood the extension spawns `fff-mcp` per enabled workspace folder and forwards tool calls over stdio JSON-RPC. Multi-root workspaces share one tool set; pass optional `workspaceFolder` (name or path) when needed.

## Migration from MCP

If you previously used this extension’s MCP server provider (≤ 0.0.x) or a global `fff` entry in user `mcp.json`:

1. Remove any global / user `fff-mcp` MCP entries so tools are not duplicated.
2. Reload the window; enable **FFF Grep / Find Files / Multi Grep** in Chat tools if prompted.
3. First invocation may ask for confirmation — choose **Always Allow** for a smoother agent loop.

## Settings

| Setting | Scope | Default | Description |
|---------|-------|---------|-------------|
| `fff.enabled` | resource | `true` | Enable FFF tools for this folder |
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

- **FFF: Show Status** — print resolved command/args and whether an `fff-mcp` session is running for each folder.

## Development

```bash
npm install
npm run compile
# F5 → "Run Extension"
```

In the Extension Development Host:

1. Open a project folder.
2. Open Chat (agent mode) and confirm FFF tools appear (not as an MCP server).
3. Optionally run **FFF: Show Status**.

## Notes

- Prefer this extension over a global `fff` entry in user `mcp.json` for project work.
- Multi-root workspaces get one `fff-mcp` process per enabled folder (started lazily on first tool use).
- Child processes are owned by the extension and killed on deactivate / config change.
