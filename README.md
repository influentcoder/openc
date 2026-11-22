# openc

A local orchestrator for AI coding sessions on top of existing agent harnesses
(Claude Code first; Codex and Pi planned), using your own subscriptions, with
watchers that wake sessions up on external events.

Status: M1. Sessions and chat work with Claude Code (through the Claude Agent SDK) and with a fake backend for development and tests.

## Quick start

Requires Node 22.18+ and pnpm, on Linux or WSL.

```sh
pnpm install
pnpm dev:fake      # whole app on fakes; open the printed http://localhost:5173/?token=… link
pnpm check         # typecheck, lint, code rules, boundaries, unit + integration tests
pnpm e2e           # Playwright against the app on fakes
```

`pnpm dev` runs against Claude Code using your own `claude` login (or
`ANTHROPIC_API_KEY`). Run openc as your normal user, not root: Claude Code
refuses its no-permission-prompt mode as root.

To check the Claude Code adapter against the real thing (uses your plan or API
credits, a few cheap prompts on Haiku):

```sh
pnpm test:contract:live
OPENC_RECORD_CLAUDE_FIXTURES=fixtures/claude-code/recorded pnpm test:contract:live   # also record fixtures
```

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decision records](docs/decisions/)
- [Contributing rules for humans and agents](AGENTS.md)
