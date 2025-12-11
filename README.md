# Incident Response Demo

Lightweight demo that walks through a broken login after a bad release, inspects mocked observability data via MCP servers, applies a config fix, and proves the login works again.

## Prereqs
- Node 18+ (tested with Node 24)
- No external services or dependencies required

## Quick start
1) Start the app server: `npm start` (serves at http://localhost:3000)
2) Start all mocked MCP servers in one terminal: `npm run start:mcps`
   - Or run individually in separate terminals if you prefer:
     - `node servers/mock-cloudwatch-mcp.js`
     - `node servers/mock-datadog-mcp.js`
     - `node servers/mock-config-mcp.js`
3) Open the app in a browser. Use `demo@example.com` / `password1`.
   - With the current broken config, login fails (post-release salt drift).
4) Use Codex CLI to call the MCP tools:
   - CloudWatch: `search_logs`, `tail_errors`
   - Datadog: `get_trace_by_request_id`, `summarize_errors`
   - Config: `get_runtime_config`, `diff_good_vs_active`
5) Let Codex identify and apply the fix (align `runtime.active.json` to the good state).
6) Retry login — succeeds and shows the dashboard.

## Demo narrative (prompt crib sheet)
- Reproduce: attempt login, see failure after release `release-2024.11.0`.
- Ask Codex to query the MCP servers; the failing request/trace in fixtures is `req-8812` / `trace-4401` (also `req-7777` / `trace-5602` for the 500).
- Codex summarizes logs/traces and the config diff pointing at the rotated salt.
- Codex applies the fix by aligning `runtime.active.json` to `runtime.good.json`.
- Re-run login → success → navigate dashboard → push Jira update.
- Reset to broken state anytime: `npm run demo:reset-broken`.

### Fixture identifiers
- CloudWatch log entries live in `fixtures/cloudwatch/auth-log.jsonl` and include `request_id` + `trace_id`.
- Datadog traces live in `fixtures/datadog/traces.json` with the same IDs.
- You won’t see these IDs in the browser UI or network tab; they’re in the mocked MCP data. Ask Codex to pull them via the MCP tools (e.g., `tail_errors` or `search_logs`), then follow the linked trace in Datadog.

## MCP tool reference
All MCP servers speak stdio JSON-RPC (`Content-Length` framed) and read from `fixtures/`.

Example Codex CLI config snippet:
```json
{
  "mcpServers": {
    "mock-cloudwatch": { "command": "node", "args": ["servers/mock-cloudwatch-mcp.js"] },
    "mock-datadog": { "command": "node", "args": ["servers/mock-datadog-mcp.js"] },
    "mock-config": { "command": "node", "args": ["servers/mock-config-mcp.js"] }
  }
}
```

### mock-cloudwatch-mcp
- `search_logs({ request_id?, trace_id?, contains?, limit? })`
- `tail_errors({ limit? })`
Data: `fixtures/cloudwatch/auth-log.jsonl`

### mock-datadog-mcp
- `get_trace_by_request_id({ request_id })`
- `summarize_errors({ since_minutes? })`
Data: `fixtures/datadog/traces.json`

### mock-config-mcp
- `get_runtime_config({})` → returns `runtime.active.json`
- `diff_good_vs_active({})` → structural diff vs `runtime.good.json`
Data: `fixtures/config/runtime.*.json`

## Resetting states
- Broken (post-release failure): `npm run demo:reset-broken`
- Fixed (pre-release good state, if you need to fast-forward): `npm run demo:apply-fix`
If you want to re-run the demo loop manually, stash or reset your changes to `fixtures/config/runtime.active.json` and then `npm run demo:reset-broken`.

## Tests
Run `npm test` (Node test runner). It asserts the broken login fails and the good config passes.
