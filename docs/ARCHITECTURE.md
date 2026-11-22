# openc — Architecture (v0.3)

Companion to `REQUIREMENTS.md`. Describes the stack, process model, backend
adapter interface, event model, storage, workspaces and diffs, watchers and
testability.

openc is an orchestrator: it never runs an agent loop itself. Everything that
talks to a model goes through a backend adapter.

## 1. Stack

Chosen to be boring, mainstream and strongly typed, so AI agents (and humans)
can work on it reliably.

| Concern                   | Choice                                                     | Why                                                        |
| ------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| Language                  | TypeScript (strict) everywhere                             | One language; Agent SDK, Codex and Pi tooling are TS-first |
| Runtime                   | Node 22.18+, running `.ts` directly (decision 0001)        | No server build step; what the Agent SDK is tested on      |
| Package manager           | pnpm                                                       | Fast, strict, common                                       |
| Server                    | Hono on `@hono/node-server` + `ws`                         | Small, typed, standard                                     |
| Validation / shared types | Zod schemas in `src/shared`                                | Runtime-checked protocol shared by server and web          |
| Database                  | SQLite via `better-sqlite3` + Drizzle ORM, FTS5 for search | Single file, synchronous, no server                        |
| Frontend                  | React + Vite + Tailwind                                    | Most widely known stack                                    |
| Client state              | TanStack Query + React state                               | Simple, well known                                         |
| Diff view                 | Monaco diff editor (`@monaco-editor/react`)                | Mature side-by-side/inline diffs                           |
| Git                       | `git` CLI via `execa` (no libgit2)                         | Exact behaviour of the user's git; worktrees supported     |
| Lint/format               | Biome                                                      | One fast tool                                              |
| Boundaries                | dependency-cruiser                                         | Enforces import rules between layers                       |
| Logging                   | pino (structured JSON)                                     | Searchable logs with session/turn ids                      |
| Git hooks                 | lefthook                                                   | Fast checks before commit                                  |
| Tests                     | Vitest (unit/integration/contract), Playwright (e2e)       | Standard                                                   |

Single package (no monorepo tooling) to keep things simple. Folders marked
_(planned)_ do not exist yet.

```
openc/
  src/
    shared/              # zod schemas: ids, sessions, events, REST + live protocol
    server/
      main.ts            # entry: parse args, compose, start, print URL with token
      server.ts          # http server + websocket upgrade
      composition.ts     # the only place that wires real or fake dependencies
      config.ts
      http/              # Hono routes, access guard, error mapping
      live/              # websocket hub (subscriptions, backlog replay, viewers)
      sessions/          # SessionManager, LiveProcesses, event log, repository
      backends/
        backend-adapter.ts          # BackendAdapter interface
        backend-adapter.contract.ts # contract suite for every adapter
        fake/            # scripted backend for tests and dev:fake
        claude-code/     # Agent SDK adapter (+ testing/ fake client replaying fixtures)
      workspace/         # scratch dirs, directory browser; (planned) worktrees, snapshots
      settings/          # key/value settings, new-session defaults
      platform/          # clock, ids, logger, async queue
      testing/           # fake clock, test harnesses (test-only, enforced)
      db/                # drizzle schema + migrations
      watchers/          # (planned) trigger engine + sources
      agent-tools/       # (planned) openc MCP tools exposed to sessions
      notify/            # (planned) notification channels
    web/
      server-connection/ # HTTP client, live websocket connection, token
      app/               # App shell, services context, hash routing
      sessions/          # sidebar
      chat/              # transcript model + views, composer
      new-session/       # dialog, folder picker, form logic
      testing/           # fakes of the API and live connection
  scripts/               # dev runner, code-rules checker
  tests/e2e/             # Playwright, against the app on fakes
  docs/                  # requirements, architecture, decisions/
  AGENTS.md              # rules for agents (CLAUDE.md links to it)
```

Commands: `pnpm dev`, `pnpm dev:fake`, `pnpm check`, `pnpm e2e`,
`pnpm test:contract:live` (see AGENTS.md).

## 2. Process model

```
Browser ──WS/REST──► openc server (Node) ──► Claude Agent SDK ──► claude CLI process (per session)
                         │                 └─► codex app-server (later)
                         ├─► SQLite (~/.openc/openc.db)
                         └─► git (worktrees, snapshots)
```

- The server is the single owner of agent processes. Browsers are views.
- `SessionManager` holds a `SessionRuntime` per _active_ session. A runtime
  wraps one `BackendSession` and pipes its events into the store and the
  WS hub.
- A scheduler enforces the live-process limit (R-SES-9, LRU eviction of idle
  processes) and the 10-minute idle release (R-SES-15).
- Session states vs. process states:

```
           send / trigger                 turn ends
 released ───────────────► starting ──► running ───► idle(live)
    ▲        (resume)                       ▲           │
    │                                       └── send ───┤
    └──────────── idle 10 min / LRU eviction ───────────┘
```

- **Resume path** (R-SES-16/17), used for user messages, watcher triggers and
  server restarts:
  1. Check workspace exists (R-SES-19); compute "changed since last turn" note
     from snapshots (R-SES-18).
  2. `adapter.resume({ backendSessionId, cwd, … })`.
  3. If native resume fails → start a fresh backend session seeded with a
     summary generated from openc's event log; record `context.rebuilt`.
- **Transcript retention**: the Claude Code adapter passes the SDK's
  `sessionStore` option (alpha) backed by SQLite, so Claude transcripts are
  mirrored into openc and resume loads from there, independent of Claude
  Code's `cleanupPeriodDays`. Fallback if that API is unsuitable: copy the
  transcript JSONL into `~/.openc/transcripts/` after each turn and restore it
  before resume.
- On server restart, sessions that were running are marked `error`
  ("interrupted by restart") and can be resumed.
- openc should run as a `systemd --user` service so watchers keep working;
  `openc install-service` generates the unit.

## 3. Backend adapter interface

The core only talks to this interface. **Implemented so far** is the subset in
`src/server/backends/backend-adapter.ts` (text messages, streaming, tools,
usage, interrupt, resume); the sketch below is the target. It is designed against Claude Code
(Agent SDK), Codex (`codex app-server`, JSON-RPC) and Pi (RPC mode). Concepts
are close to the Agent Client Protocol (ACP) so an ACP-based adapter stays
possible, but we do not depend on ACP: the Agent SDK exposes more (usage,
rate limits, model switching, plan mode) than the ACP adapters do today.

```ts
// src/server/backends/types.ts (sketch)
export interface BackendAdapter {
  readonly id: BackendId; // 'claude-code' | 'codex' | 'pi' | 'fake'
  readonly displayName: string;
  status(): Promise<BackendStatus>; // installed, version, auth: 'subscription'|'api-key'|'none', plan
  listModels(): Promise<ModelInfo[]>;
  capabilities(): BackendCapabilities;
  start(opts: StartOptions): Promise<BackendSession>;
  resume(opts: ResumeOptions): Promise<BackendSession>;
}

export interface StartOptions {
  cwd: string; // worktree, folder or scratch dir
  model?: string;
  permissionMode: PermissionMode; // openc-level enum, mapped per backend
  sessionId: string; // openc session id (for logging)
}
export interface ResumeOptions extends StartOptions {
  backendSessionId: string;
}

export interface BackendSession {
  readonly backendSessionId: Promise<string>; // known after init
  events(): AsyncIterable<BackendEvent>; // normalised events + raw payload
  send(input: UserInput): Promise<void>; // text + images
  interrupt(): Promise<void>;
  respondToPermission(requestId: string, decision: PermissionDecision): Promise<void>;
  setModel?(model: string): Promise<void>;
  setPermissionMode?(mode: PermissionMode): Promise<void>;
  listCommands?(): Promise<SlashCommand[]>;
  close(): Promise<void>;
}

export interface BackendCapabilities {
  modelSwitchMidSession: boolean;
  images: boolean;
  planMode: boolean;
  slashCommands: boolean;
  thinking: boolean;
  usage: "tokens" | "tokens+cost" | "none";
  rateLimits: boolean;
}

export type PermissionMode = "never-ask" | "ask-edits" | "ask-all" | "plan";
```

### Claude Code adapter

Implemented in `src/server/backends/claude-code/` (decision 0004):

```
ClaudeCodeAdapter ─► ClaudeAgentClient (port) ─► SdkClaudeAgentClient ─► Agent SDK query() ─► claude CLI
        │                                    └─► FakeClaudeAgentClient (tests: replays fixtures/claude-code/)
        └─► ClaudeCodeSession: raw message ─► parseClaudeMessage (zod) ─► ClaudeMessageTranslator ─► BackendEvent
```

- One `query()` per live session in **streaming input mode**: `prompt` is an
  async queue of user messages, so one process serves the whole conversation.
- Options (`query-options.ts`): `cwd`, `model` (omitted for the `default`
  alias), `sessionId` for a new conversation (openc generates the UUID, so the
  id is known before the first message) or `resume` for an existing one,
  `includePartialMessages: true`, `permissionMode: "bypassPermissions"` with
  `allowDangerouslySkipPermissions` (R-CHAT-7), and
  `settingSources: ["user", "project", "local"]` so CLAUDE.md, MCP servers and
  skills apply.
- Resume checks `getSessionInfo(id, { dir })` first and throws
  `BackendSessionNotFoundError` when Claude Code no longer has the transcript,
  which triggers the context-rebuilt path.
- Status and models come from one short-lived probe `query()`
  (`supportedModels()`, `accountInfo()`), cached until it fails. Only the plan
  type and API key source are used; the e-mail address is never read.
- Translation: text deltas are keyed by API message id + text block ordinal,
  so streamed deltas and the final per-block assistant messages line up;
  replies that were not streamed get one delta with the whole text. Tool use
  and tool results become `tool.started` / `tool.completed` (kind and summary
  from `tool-presentation.ts`). A result ends the turn: interrupted when openc
  asked for an interrupt or `terminal_reason` is `aborted_*`, error when
  `is_error` or a non-success subtype. Assistant messages carrying an `error`
  are skipped because the result reports the same failure.
- Not yet translated: subagent messages (`parent_tool_use_id` set), thinking,
  to-dos, plan mode, permission prompts, rate-limit events.
- Auth: no API key is passed; the CLI uses the user's own login or
  `ANTHROPIC_API_KEY`. Claude Code refuses bypass mode as root, so openc must
  run as a normal user.
- Fixture recording: set `OPENC_RECORD_CLAUDE_FIXTURES=<dir>` (server or
  `pnpm test:contract:live`) to write each conversation as fixture JSONL,
  scrubbed of paths and system-message details (`fixtures/claude-code/README.md`).

### Fake adapter

Scripted, deterministic backend used by `pnpm dev:fake` and the e2e tests (`backends/fake/`): replies `Echo #n: <text>`
where `n` counts messages in the backend conversation (so resume is
observable), runs a fake `ls` tool when the message contains "tool", streams
slowly with "slow", and fails with "fail". Fidelity to Claude Code itself is
covered separately by the Claude Code adapter's fixture-replaying fake client.

## 4. Event model

Every session has an append-only event log; each event has a per-session
monotonically increasing `seq`. `src/shared/events.ts` is the source of truth;
implemented today: `turn.started`, `assistant.message`, `tool.started`,
`tool.completed`, `usage`, `turn.completed`, `backend.started` (with
`resumed`), `context.rebuilt`. The sketch below is the target.

```ts
type HarnessEvent =
  | { type: "session.started"; backendSessionId: string; model: string }
  | { type: "turn.started"; turnId: string; input: UserInput }
  | { type: "assistant.delta"; turnId: string; messageId: string; text: string }
  | { type: "assistant.message"; turnId: string; messageId: string; content: ContentBlock[] }
  | { type: "thinking"; turnId: string; text: string }
  | {
      type: "tool.started";
      turnId: string;
      toolCallId: string;
      name: string;
      input: unknown;
      kind: ToolKind;
    }
  | {
      type: "tool.completed";
      turnId: string;
      toolCallId: string;
      output: unknown;
      isError: boolean;
    }
  | { type: "permission.requested"; requestId: string; toolCallId?: string; summary: string }
  | { type: "permission.resolved"; requestId: string; decision: PermissionDecision }
  | { type: "todos.updated"; items: TodoItem[] }
  | { type: "subagent.started" | "subagent.completed"; id: string; description: string }
  | { type: "plan.proposed"; plan: string }
  | { type: "usage"; turnId: string; inputTokens: number; outputTokens: number; costUsd?: number }
  | { type: "rate-limit"; windows: RateLimitWindow[] }
  | {
      type: "turn.completed";
      turnId: string;
      reason: "end" | "interrupted" | "error";
      error?: string;
    }
  | { type: "status"; status: SessionStatus }
  | { type: "raw"; backend: BackendId; payload: unknown }; // unknown/unmapped
// envelope: { sessionId, seq, ts, event, rawRef? }
```

- `ToolKind` (`read` | `edit` | `execute` | `search` | `fetch` | `other`) lets the UI
  render tools generically across backends.
- `assistant.delta` events are streamed to clients but **not persisted**;
  the final `assistant.message` is.
- Raw backend payloads are stored separately (`raw_events`) and linked by `rawRef`.

### Client sync

- One WebSocket per browser at `/ws?token=…` (`src/shared/live-protocol.ts`).
  Client → server: `subscribe {sessionId, sinceSeq}` (server replays the
  backlog from SQLite, then streams live) and `unsubscribe`. Server → client:
  `session.event`, `session.delta` (only to subscribers of that session) and
  `session.updated` / `session.deleted` (to everyone, for the sidebar).
- A subscribed client counts as a viewer of the session (R-SES-15).
- On reconnect the client re-subscribes with the last `seq` it saw.
- Commands from the client (send, interrupt, permission response, …) go over
  REST; results arrive as events. This keeps one source of truth.

## 5. Storage

SQLite at `~/.openc/openc.db`, migrations generated by drizzle-kit
(`pnpm db:generate`). Implemented today: `sessions`, `events`, `settings`.
Target tables:

| Table                 | Content                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `projects`            | folder path, is_git, display name, last used                                                                                                                                                                       |
| `sessions`            | id, project_id (nullable), title, backend, model, workspace_mode (`directory`/`worktree`/`scratch`), cwd, branch, base_ref, backend_session_id, status, permission_mode, archived_at, last_activity_at, timestamps |
| `backend_transcripts` | session_id, backend, entry uuid, json — mirror of the backend transcript (`sessionStore`)                                                                                                                          |
| `watchers`            | id, session_id or project_id, source (`github-pr`, `fs`, …), config json, policy json, state (`active`/`paused`/`stopped`), cursor json                                                                            |
| `triggers`            | id, watcher_id, session_id, batched event refs, status (`queued`/`running`/`done`/`dismissed`), turn_id, outcome (`resolved`/`needs_user`/`failed`), pending_items json                                            |
| `source_events`       | id, watcher_id, external id (dedup), kind, json, received_at                                                                                                                                                       |
| `turns`               | id, session_id, index, started/ended, start_snapshot, end_snapshot                                                                                                                                                 |
| `events`              | session_id, seq, ts, type, json                                                                                                                                                                                    |
| `raw_events`          | id, session_id, backend, json                                                                                                                                                                                      |
| `diff_comments`       | session_id, file, line range, text, sent_in_turn                                                                                                                                                                   |
| `settings`            | key/value (last backend/model, last workspace mode, limits, …)                                                                                                                                                     |
| `events_fts`          | FTS5 index over message text and tool summaries                                                                                                                                                                    |

## 6. Workspaces and diffs

### Worktrees

- Create: `git -C <repo> worktree add -b openc/<slug> <path> <base-commit>`.
- Delete (R-SES-12): compute warnings first (`git status --porcelain`,
  `git log <base>..openc/<slug>`), then `git worktree remove --force <path>`
  and `git branch -D openc/<slug>`.
- Merge: `git -C <repo> merge openc/<slug>` into the base branch (fails safely
  on conflicts or a dirty base checkout; reported in the UI).
- PR: `git push -u origin openc/<slug>` then `gh pr create` if `gh` exists.

### Snapshots (for "Session" and "Last turn" diffs)

Snapshots capture the full working tree, including untracked files, **without
touching the user's index, HEAD or stash**:

```
GIT_INDEX_FILE=<tmp-index> git add -A          # respects .gitignore
GIT_INDEX_FILE=<tmp-index> git write-tree      # → tree hash
git update-ref refs/openc/<session>/<turn> <commit-wrapping-tree>   # keep from gc
```

- Taken at session start and at each turn start/end.
- "Session" diff = session start snapshot (or base commit for worktrees) vs.
  live working tree. "Last turn" = last turn's start snapshot vs. its end
  snapshot (or live tree while running).
- Non-git folders and scratch dirs use a **shadow repo** at
  `~/.openc/shadow/<project-hash>` (`--git-dir` shadow, `--work-tree` folder),
  same commands.
- Refs under `refs/openc/` are removed when the session is deleted.

### Live refresh

A file watcher (chokidar) on the session cwd, debounced, triggers diff
recomputation and a `diff.changed` notification to subscribed clients.

## 7. Security

- Bind `127.0.0.1`; random token stored in `~/.openc/token`, required on REST and
  WS (cookie set after first visit via `?token=`).
- Directory browser and all file APIs restricted to paths under the user's home
  (configurable allow-list).
- Never run as root (refuse to start).

## 8. Watchers

### 8.1 Components

```
WatcherSource ──SourceEvent──► TriggerEngine ──► SessionManager.trigger(session, prompt)
 (github-pr, fs,                (filter, dedup,        │
  schedule, telegram)            batch, policy,        ▼
                                 loop guards)     agent turn ──► openc_report_outcome
                                                                   │
                                          Inbox / notifications ◄──┘ (needs_user, failed)
```

```ts
interface WatcherSource<Config> {
  readonly kind: string; // 'github-pr' | 'fs' | 'schedule' | 'telegram'
  configSchema: z.ZodType<Config>;
  start(ctx: {
    config: Config;
    cursor: unknown;
    emit(e: SourceEvent): void;
    saveCursor(c: unknown): void;
  }): Promise<{ stop(): Promise<void> }>;
}

interface SourceEvent {
  externalId: string; // dedup key
  kind: string; // e.g. 'ci.failed', 'review.submitted', 'comment.created'
  author?: string;
  batchKey: string; // events with the same key are batched together
  readyAt?: Date; // e.g. CI: only when all checks completed
  payload: unknown; // untrusted
  links: { label: string; url: string }[];
}
```

- **TriggerEngine** persists events (`source_events`), applies filters
  (author allow-list, ignore own actions), debounces per `batchKey`, applies
  loop guards (attempts per failure signature, daily cap), then creates a
  `trigger`. If the session is busy the trigger is queued (R-W-3).
- A trigger's prompt is rendered from a per-source template: short
  instructions from openc + the event payload wrapped in an explicit
  `<untrusted_external_data>` block + the expected outcome contract.
- Triggered turns run with the session's permission mode plus extra
  constraints from the watcher policy (e.g. a `PreToolUse` hook / `canUseTool`
  rule blocking `git push --force` and pushes to other branches).

### 8.2 GitHub PR source

- Uses the user's `gh` CLI auth (`gh api`), no token handling in openc.
- **Polling**, not webhooks: openc is localhost-only, and polling needs no
  tunnel. One poller per repo batches all watched PRs; conditional requests
  (`ETag` / `If-None-Match`) so unchanged polls don't count against the rate
  limit. Interval 30–60 s while CI is running, slower otherwise.
- Reads: PR state/mergeability, check runs + workflow runs for the head SHA,
  reviews, review comments, issue comments. Failing job logs are fetched and
  trimmed to the relevant part before being given to the agent.
- Own actions are recognised by the commit SHAs the session pushed and by a
  hidden marker in comments openc/the agent posts.
- Optional later: webhook delivery through a relay (e.g. `gh webhook forward`)
  for lower latency.

### 8.3 Inbox and notifications

- The inbox is a query over sessions in `waiting` plus open triggers with
  outcome `needs_user`/`failed`.
- `NotificationChannel` interface (`browser` in MVP; `telegram`, `ntfy` later),
  with per-channel rules (e.g. only when no browser tab is focused).

### 8.4 openc agent tools

An MCP server exposed to every session (in-process for the Agent SDK; stdio
server for other backends):

| Tool                                                     | Purpose                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `openc_report_outcome(status, summary, pending_items[])` | Ends a triggered turn with a machine-readable outcome         |
| `openc_watch_pr(pr?)`                                    | Link + watch a PR (defaults to the PR for the session branch) |
| `openc_unwatch(watcher_id)`                              | Stop a watcher                                                |
| `openc_notify_user(message)`                             | Ask for attention without stopping                            |

If a triggered turn ends without calling `openc_report_outcome`, the outcome
is `needs_user` with the agent's last message as summary.

## 9. Testability

Every external dependency is a port (interface) with a real and a fake
adapter, chosen in a single composition root (`src/server/composition.ts`).
`pnpm dev:fake` and all automated tests use the fakes.

| Port                  | Real                               | Fake                                                        | Fidelity source                                   |
| --------------------- | ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| `BackendAdapter`      | Claude Agent SDK (later Codex, Pi) | replays recorded SDK message streams, scripted per scenario | recorded real sessions in `fixtures/claude-code/` |
| `GitHubClient`        | `gh api`                           | in-memory GitHub (PRs, checks, reviews, comments, ETags)    | recorded API responses in `fixtures/github/`      |
| `Clock`               | system time                        | manually advanced clock                                     | n/a                                               |
| `ProcessSpawner`      | `execa`                            | scripted processes                                          | n/a                                               |
| `NotificationChannel` | browser push                       | in-memory recorder                                          | n/a                                               |
| `FileWatcher`         | chokidar                           | event emitter driven by tests                               | n/a                                               |
| `IdGenerator`         | random UUIDs                       | sequential ids                                              | n/a                                               |

Not faked: git and SQLite (real, in temporary directories).

**Contract tests**: each port has one shared suite
(`<port>.contract.ts`) that runs against the fake in `pnpm check` and against
the real adapter in `pnpm test:contract:live`. A fixture-recording mode on the
real adapters captures new fixtures (scrubbed of tokens and personal data)
when behaviour upstream changes.

## 10. Open technical questions (resolve in M0)

1. Does the Agent SDK's bundled CLI pick up the user's existing `claude` login
   (subscription) in all cases, including WSL? Fallback: point
   `pathToClaudeCodeExecutable` at the user's installed `claude`.
2. Exact mapping of SDK message types → `HarnessEvent` (especially subagent and
   task events, plan mode approval flow).
3. Memory/CPU per idle Claude Code process → tune the live-process limit.
4. Is the alpha `sessionStore` stable enough, or use the JSONL-copy fallback?
5. Codex: `app-server` protocol vs. ACP adapter — decide at M6.
