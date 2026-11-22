# AGENTS.md

Rules for anyone (human or AI agent) changing this repository.
Product: `docs/REQUIREMENTS.md`. Design: `docs/ARCHITECTURE.md`.
Decisions and their rationale: `docs/decisions/`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Server + web with real backends |
| `pnpm dev:fake` | Same, with every external dependency faked |
| `pnpm check` | Typecheck, lint, file-size check, boundary rules, unit + integration tests. Must pass before every commit |
| `pnpm e2e` | Playwright tests against the app running on fakes |
| `pnpm test:contract:live` | Contract tests against real dependencies (needs local logins; manual) |

## Code style

- **No comments.** Code must explain itself through names, types and small
  functions. The only allowed comment is a non-obvious workaround with a link
  to its upstream issue. Rationale belongs in `docs/decisions/` or the commit
  message.
- **Small files.** Hard limit 300 lines per file (enforced by `pnpm check`),
  aim for under 200. Functions around 40 lines at most. Split by
  responsibility, not by layer.
- **Feature folders.** Code is grouped by feature; tests sit next to the code
  (`foo.ts`, `foo.test.ts`).
- **Strict types.** No `any`, no non-null assertions, no type casts to silence
  errors. Branded types for ids (`SessionId`, `WatcherId`). Validate all
  external input with Zod at the boundary; trust types inside.
- **Explicit names.** No abbreviations; a reader should not need to open a
  function to know what it does.
- **Errors.** Never swallow an error. Expected failures are typed results at the
  boundary; unexpected ones throw and are logged with context.
- **Logging.** Structured logs (pino) with `sessionId` / `turnId` / `watcherId`.
- **Boundaries** (enforced by dependency-cruiser): `web` never imports `server`;
  `shared` imports nothing from the app; core code depends on interfaces, never
  on a concrete backend, GitHub client or other external adapter.
- **Dependencies.** Prefer few, well-known libraries. Ask before adding one.
- **Migrations.** Never edit a migration that has been committed; add a new one.

## Testing

- Every behaviour change comes with automated tests. Every bug fix starts with
  a failing test that reproduces it.
- Name tests after requirement ids where one applies:
  `describe('R-SES-12 delete session', …)`.
- **Every external dependency sits behind an interface** with a real and a fake
  implementation, wired in one composition root: backend harnesses, GitHub,
  clock, process spawning, notifications, file watching.
- **Fakes must behave like reality.** Each interface has one contract test suite
  run against both the fake (always) and the real implementation
  (`pnpm test:contract:live`). Fakes replay recorded real interactions
  (e.g. raw Claude Agent SDK messages, GitHub API responses) stored under
  `fixtures/`, scrubbed of personal data.
- **Use the real thing when it is local and fast:** git and SQLite run for real in
  temporary directories.
- **Deterministic tests:** no network, no `sleep`, no real time. Timers go through
  the injected clock; ids through an injected generator.
- UI: component tests with Vitest + Testing Library; user flows with Playwright
  against `pnpm dev:fake`.

## Workflow

- Small, focused commits; message explains why, not what.
- Significant design choices get a short decision record in `docs/decisions/`.
- Keep `REQUIREMENTS.md` and `ARCHITECTURE.md` in sync with what is built.
