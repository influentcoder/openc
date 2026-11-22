# openc

A local orchestrator for AI coding sessions on top of existing agent harnesses
(Claude Code first; Codex and Pi planned), using your own subscriptions, with
watchers that wake sessions up on external events.

Status: M1 skeleton running on a fake backend. The Claude Code adapter is next.

## Quick start

Requires Node 22.18+ and pnpm, on Linux or WSL.

```sh
pnpm install
pnpm dev:fake      # whole app on fakes; open the printed http://localhost:5173/?token=… link
pnpm check         # typecheck, lint, code rules, boundaries, unit + integration tests
pnpm e2e           # Playwright against the app on fakes
```

`pnpm dev` runs against real backends (none are wired yet).

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decision records](docs/decisions/)
- [Contributing rules for humans and agents](AGENTS.md)
