# openc — Requirements (v0.2)

openc is a local web app for running AI coding sessions on top of existing
agent harnesses (Claude Code first, then Codex, Pi, …). openc owns the UI,
sessions, history and workspaces; the underlying harness owns the agent loop,
tools and authentication.

Status: agreed draft. IDs (`R-…`) are stable so code, tests and issues can
reference them.

## 1. Goals and non-goals

**Goals**
- One UI to run coding agents from several harnesses, side by side.
- Use the user's existing **subscriptions** (Claude Pro/Max, ChatGPT plan)
  through the official CLIs, with API keys as an alternative.
- Run many sessions in parallel, isolated in git worktrees when wanted.
- One unified, searchable history across all backends.
- First-class review of the changes an agent makes.

**Non-goals (for now)**
- Multi-user or hosted deployment. Single user, single machine.
- Distributing the app to others (affects the subscription question, see §9).
- Switching backend within a session.
- macOS / native Windows. Linux and WSL only.
- Calling model APIs directly with our own agent loop.

## 2. Platform

- **R-PLAT-1** Local web app: a Node server on the user's machine, UI in the browser.
- **R-PLAT-2** Supported OS: Linux and WSL2.
- **R-PLAT-3** The server binds to `127.0.0.1` only and requires a random access
  token (generated on first run, passed via the URL it prints).
- **R-PLAT-4** Sessions are owned by the server, not the browser tab: closing the
  tab does not stop running sessions; reopening reconnects and replays
  missed events.
- **R-PLAT-5** All openc state lives under `~/.openc/` (configurable).

## 3. Layout

```
┌────────────┬───────────────────────────────────┬──────────────┐
│ Sessions   │ Header: title · backend/model ·   │ Diff pane    │
│ sidebar    │ folder · branch · status · usage  │ (collapsible)│
│            ├───────────────────────────────────┤              │
│ + New      │                                   │ [Session |   │
│ search     │ Chat transcript                   │  Last turn]  │
│            │                                   │              │
│ ● running  │                                   │ file tree    │
│ ◐ waiting  │                                   │ + diffs      │
│ ✓ done     ├───────────────────────────────────┤              │
│ ✕ error    │ Composer (text, images, stop)     │ actions      │
└────────────┴───────────────────────────────────┴──────────────┘
```

- **R-UI-1** Left sidebar: session list grouped by project (folder), newest
  activity first; each row shows title, backend/model, status badge, and
  worktree/branch indicator.
- **R-UI-2** Sidebar search across session titles and full history (§7).
- **R-UI-3** Main pane: streamed chat transcript and composer.
- **R-UI-4** Right pane: collapsible diff review (§6). Collapsed state remembered.
- **R-UI-5** Keyboard shortcuts for new session, switch session, toggle diff pane,
  stop/interrupt.

## 4. Sessions

### 4.1 Creating a session
- **R-SES-1** "New session" dialog with:
  - **Backend** (Claude Code in MVP) and **model** (list provided by the backend).
  - **Folder**: a project folder, or **No folder** (scratch, see R-SES-6).
  - **Workspace mode** (only if the folder is a git repo):
    **This directory** or **New worktree**. Default = the last chosen value
    (remembered globally).
  - **Base branch** for a new worktree (default: the repo's current branch).
  - Optional first message; the session can also start empty.
- **R-SES-2** Folder picker: a server-side directory browser plus recent folders
  and detected git repos. (Browsers cannot browse the local disk.)
- **R-SES-3** Default backend and model = last used.

### 4.2 Workspaces
- **R-SES-4 New worktree**: created at
  `~/.openc/worktrees/<repo-name>-<short-hash>/<session-slug>` on a new branch
  `openc/<session-slug>`, based on the chosen base branch's current commit.
- **R-SES-5 This directory**: the agent works directly in the folder. If another
  active session already uses the same directory, show a warning (do not block).
- **R-SES-6 No folder**: each session gets a persistent scratch directory
  `~/.openc/scratch/<session-id>`; the agent has full tool access in it.
  A scratch session can later be "promoted" (moved/copied) to a real folder.
- **R-SES-7** Non-git folders are allowed with "This directory" only; the diff
  pane still works (§6, shadow snapshots).

### 4.3 Lifecycle
- **R-SES-8** Sessions can be renamed, resumed and deleted. Titles are
  auto-generated from the first message and editable.
- **R-SES-9** Multiple sessions run in parallel. A configurable limit on
  concurrently *running* agent processes (default 6); idle sessions release
  their process and are resumed on the next message.
- **R-SES-10** Status per session: `idle`, `running`, `waiting` (needs user
  input), `done`, `error`. Shown in the sidebar.
- **R-SES-11** Browser notification when a session finishes or needs input while
  it is not the one being viewed.
- **R-SES-12** **Deleting a session deletes its worktree and its branch.** The
  confirmation dialog warns explicitly when there are uncommitted changes or
  commits not merged into the base branch, listing them. Scratch directories
  are deleted too. "This directory" folders are never deleted.
- **R-SES-13** A session's backend is fixed at creation. The model can be changed
  mid-session when the backend supports it.

## 5. Chat

- **R-CHAT-1** Streamed assistant output (text and, when available, thinking
  summaries, collapsed by default).
- **R-CHAT-2** Tool calls rendered as collapsible blocks: tool name, key input
  (command, file path), status, output. File edits show an inline mini-diff.
- **R-CHAT-3** Interrupt/stop the current turn. Typing while the agent runs
  queues the message (sent after the turn) — or interrupts-and-sends on a
  modifier key.
- **R-CHAT-4** Image attachments by paste and drag-and-drop.
- **R-CHAT-5** Render harness-specific structures as UI, not raw text: to-do
  list, plan mode (plan shown with approve/reject), subagent activity,
  compaction markers, errors and retries.
- **R-CHAT-6** Slash commands supported by the backend are offered with
  autocomplete (list from the backend).
- **R-CHAT-7** Permissions: **default mode is "never ask"** (maximum autonomy,
  Claude Code `bypassPermissions`). The mode can be changed per session
  (e.g. plan mode, ask before edits). When the backend does ask, the request is
  shown inline with approve/deny and the session shows `waiting`.
- **R-CHAT-8** Usage display: tokens per turn and session; plan rate-limit
  utilisation when on a subscription; cost only when on API credits.

## 6. Diff review pane

- **R-DIFF-1** Two views:
  - **Session**: everything changed since the session started (worktree: vs.
    the base commit; this-directory/scratch: vs. the snapshot taken at
    session start).
  - **Last turn**: changes made during the most recent agent turn only.
- **R-DIFF-2** File tree with change counts; side-by-side or inline diff per
  file (Monaco diff editor).
- **R-DIFF-3** **Line comments**: select lines in a diff, write a comment; comments
  are batched and sent to the agent as a message with file/line references.
- **R-DIFF-4** Actions (git sessions):
  - Commit (message suggested by the agent, editable).
  - Revert a file or hunk.
  - Merge the session branch into the base branch (worktree sessions).
  - Push branch and open a PR (requires `gh` on the machine; hidden if absent).
  - Discard all session changes.
- **R-DIFF-5** The diff is computed by openc from the filesystem, not from
  backend events, so it is backend-agnostic and catches changes made by shell
  commands.
- **R-DIFF-6** The pane refreshes live while the agent works (debounced).

## 7. History

- **R-HIST-1** openc stores its own copy of every session: a normalised event log
  (messages, tool calls, permission requests, usage, …) plus the raw backend
  events for fidelity.
- **R-HIST-2** One history view across all backends and projects, filterable by
  project, backend, date, status.
- **R-HIST-3** Full-text search over messages and tool calls.
- **R-HIST-4** Importing pre-existing Claude Code history is **out of scope**.

## 8. Backends

- **R-BE-1** A single adapter interface (see `ARCHITECTURE.md`) covering: availability
  and auth check, model listing, start/resume session, send message, stream
  events, interrupt, permission responses, mode/model change, capabilities.
- **R-BE-2** **Claude Code** adapter in the MVP, via the Claude Agent SDK, using
  the user's local Claude Code login (subscription) or an API key.
- **R-BE-3** The adapter interface must be designed against Codex
  (`codex app-server`) and Pi (RPC mode) too, so they can be added without
  changing the core. Codex is the second backend.
- **R-BE-4** Settings page shows each backend: installed?, version, auth type
  (subscription plan / API key / none), and a hint how to log in.
- **R-BE-5** MCP servers, skills, CLAUDE.md etc.: at first, use each backend's
  native configuration unchanged (user + project settings are loaded).
  An openc-level shared MCP config is a later feature.

## 9. Constraints and risks

- **Subscription terms.** openc drives the user's own installed CLIs with the
  user's own login, for personal use. Anthropic does not allow third-party
  products to offer claude.ai login without approval, so this must be
  re-checked before openc is ever distributed.
- **Bypass mode as root.** Claude Code refuses `bypassPermissions` when run as
  root outside a sandbox; openc must run as a normal user (normal on Linux/WSL).
- **Never-ask default** means agents can run any command the user can. The
  localhost binding + token (R-PLAT-3) is the only network-facing protection.
- **Harness churn.** The Agent SDK and Codex protocols change often; adapters must
  isolate this and keep raw events so the UI degrades gracefully on unknown
  event types.

## 10. Milestones

| # | Scope |
|---|---|
| M0 | Spike: Agent SDK with subscription auth, streaming, interrupt, resume, bypass mode, model list. Confirm worktree + snapshot approach. |
| M1 | Skeleton: server, web UI, sidebar, chat with Claude Code, persistence, folder picker, scratch sessions. |
| M2 | Worktrees, parallel sessions, status badges, notifications, delete with warnings. |
| M3 | Diff pane: session/last-turn views, line comments, commit/revert/merge/PR/discard. |
| M4 | History view + search, usage display, images, plan mode/to-dos/subagents rendering, slash commands. |
| M5 | Codex adapter. |
| Later | Pi adapter, shared MCP config, remote access (e.g. Tailscale), macOS. |
