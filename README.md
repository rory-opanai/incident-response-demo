# Incident Response Demo

Broken login after a bad release, mocked observability via MCP, Codex fixes it, then we prove the login works and close the loop.

## Prereqs
- Node 18+ (tested with Node 24)
- No network or external services needed
- Credentials: `demo@example.com` / `password1`

## Setup (one-time)
```sh
npm install
```

## Start services (every session)
In separate terminals:
```sh
# 1) App server
npm start   # http://localhost:3000

# 2) MCP servers (all at once)
npm run start:mcps
# or individually:
# npm run start:mcp:cloudwatch
# npm run start:mcp:datadog
# npm run start:mcp:config
```

## Demo flow (step-by-step)
1) Reproduce the break: open http://localhost:3000, log in with the creds above → it fails (active config is broken).
2) Ask Codex to pull latest errors from MCPs:
   - CloudWatch: `tail_errors({ limit: 5 })` or `search_logs({ contains: "salt rotation" })`
   - Datadog: `summarize_errors()` then `get_trace_by_request_id({ request_id: "…" })`
   - Config: `diff_good_vs_active({})`
3) Have Codex explain root cause: salt drift (`demo-day-salt-v1-rotated` vs expected `demo-day-salt-v1`), so hashes don’t match.
4) Have Codex apply the fix: align `fixtures/config/runtime.active.json` to `runtime.good.json` (or let Codex patch it).
5) Refresh and log in again → dashboard shows “Everything back online” with next steps cards.
6) (Optional) Narrate Jira/doc/test follow-ups from the dashboard cards.

## Prompts you can reuse
- “Use the mock MCPs to pull the latest login errors from CloudWatch, the matching trace from Datadog, and the config diff. Summarize the root cause and apply the fix so login succeeds.”
- “After fixing, verify login at http://localhost:3000 succeeds, then summarize the RCA and next steps for Jira/docs/tests.”

## Fixture identifiers
- CloudWatch logs: `fixtures/cloudwatch/auth-log.jsonl` → has `request_id`/`trace_id`. Failing examples: `req-8812` / `trace-4401`, and `req-7777` / `trace-5602` (500).
- Datadog traces: `fixtures/datadog/traces.json` with the same IDs.
- These IDs are not in the browser UI; surface them via MCP tools.

## MCP tool reference
All mocked, stdio JSON-RPC (`Content-Length` framed), read-only from `fixtures/`.

Example Codex CLI config:
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
- Broken (demo start): `npm run demo:reset-broken`
- Fixed (if you need to fast-forward): `npm run demo:apply-fix`
To re-run the loop, stash/reset changes to `fixtures/config/runtime.active.json` then reset to broken.

## Tests
Run `npm test` (Node test runner). It asserts the broken login fails and the good config passes.
