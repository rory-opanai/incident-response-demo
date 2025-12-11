# Repository Guidelines

## Project Structure & Module Organization
- `src/server.js` hosts the demo HTTP server; `src/auth.js` and `src/config.js` handle login and runtime config loading.
- `public/` contains the static UI served by the Node server.
- `fixtures/` holds demo data: `config/runtime.*.json` for good/broken states plus log/trace fixtures consumed by the MCP servers.
- `servers/` contains stdio MCP servers; `scripts/` has helpers for toggling configs and booting MCPs; `test/` uses Node’s built-in runner.

## Build, Test, and Development Commands
- `npm start` runs the app on `PORT` (default 3000); `npm run dev` sets `NODE_ENV=development`.
- `npm run start:mcps` launches all MCP servers; `npm run start:mcp:cloudwatch|datadog|config` starts one service.
- `npm test` executes `node --test` suites.
- `npm run demo:reset-broken` resets `runtime.active.json` to the broken release; `npm run demo:apply-fix` aligns it to the good state for validation.

## Coding Style & Naming Conventions
- ESM modules only; prefer `const` and small, single-purpose functions.
- Two-space indentation, semicolons, and single quotes for strings to match existing files.
- File names stay lowercase with hyphens or short nouns (`auth.js`, `set-config-state.js`); tests mirror source names (`auth.test.js`).
- Keep runtime config filenames in the `runtime.{state}.json` pattern.

## Testing Guidelines
- Use Node’s `node:test` with `assert`; add suites under `test/` named after the module under test.
- Cover both broken and fixed flows using `fixtures/config/runtime.broken.json` and `runtime.good.json`; avoid mutating fixtures in-place during tests.
- When changing salts/password hashes, update both configs and expected hashes (`GOOD_HASH`) and rerun `npm test`.

## Commit & Pull Request Guidelines
- Current history is minimal; use concise, imperative subjects (≤72 chars) and mention the primary impact area (auth, config, MCP, UI).
- In PRs, include: summary of the change, how you validated it (`npm test`, manual login result, MCP commands), and any config state used for reproduction.
- Link related issues or demo steps and attach screenshots/GIFs for UI changes when relevant.

## MCP & Config Notes
- MCP servers speak stdio JSON-RPC; keep tool names/schemas in `servers/` aligned with the README so Codex clients stay compatible.
- When adjusting config schemas, update both `runtime.*.json` fixtures and any diffs or validation logic so the mock-config MCP stays truthful.
