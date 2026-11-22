# openc — Requirements (v0.3)

openc is a local **orchestrator of agent harnesses** (Claude Code first, then
Codex, Pi, …), with a web UI. It is not a harness itself: openc owns sessions,
workspaces, history, triggers (watchers) and notifications; the underlying
harness owns the agent loop, tools and authentication.

```
UI (web)                 sidebar · chat · diff pane · inbox · watchers
Orchestration layer      watchers/triggers · inbox · notifications · openc tools for agents
Session layer            lifecycle · workspaces (worktree/dir/scratch) · snapshots · history
Harness layer            adapters: Claude Code · Codex · Pi
```

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
- Long-lived sessions that can be resumed at any time, even months later.
- Automate follow-up work with **watchers**: e.g. a session wakes itself up
  when its PR's CI fails or receives review comments.

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
  concurrently *live* agent processes (default 6). When the limit is hit, the
  least recently used idle process is released first.
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

### 4.4 Process release, resume and retention
- **R-SES-14** An openc session (metadata, event log, workspace) is permanent until
  deleted; the backend process is transient. Viewing a session never requires
  its process: transcript and diffs come from openc's own storage.
- **R-SES-15** A live process is released after **10 minutes idle**, but never while
  the session is open on screen or has a pending trigger.
- **R-SES-16** Sending a message (or a watcher firing, §9) on a released session
  respawns the backend transparently with the same cwd and resumes the
  conversation (UI shows a brief `resuming` state). Server restarts use the
  same path.
- **R-SES-17** Resume must work regardless of session age: openc keeps its own
  copy of the backend transcript (Claude Code deletes local transcripts after
  `cleanupPeriodDays`, default 30). If native resume is impossible, openc
  starts a new backend session seeded with a summary of its own history and
  marks it in the transcript ("context rebuilt").
- **R-SES-18** On resume, if the workspace changed since the end of the last turn
  (other edits, base branch moved), openc prepends a short note to the next
  message listing changed files. For worktrees, offer to rebase on the base
  branch when it moved.
- **R-SES-19** If a session's worktree is missing on resume, offer to recreate it
  from the session branch, or continue without it.
- **R-SES-20** When resuming a large context after the prompt cache likely expired,
  show a hint with the approximate context size (it counts against plan usage).

### 4.5 Archive
- **R-SES-21** Sessions can be **archived**: hidden from the sidebar, still in
  History and search, workspace kept. Un-archive at any time.
- **R-SES-22** Auto-archive sessions with no activity for N days (default 14,
  configurable, can be disabled). Watched sessions (§9) are never
  auto-archived while their watcher is active. Sessions whose PR got merged
  or closed are auto-archived.
- **R-SES-23** Archive view shows per-session disk usage and offers to clean up
  worktrees whose branch is merged into the base branch. Nothing is deleted
  without explicit user action.

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

## 9. Watchers (draft)

A **watcher** connects an external source of events to a session. When it
fires, openc wakes the session (respawning it if needed) with a prompt built
from the event, and the agent works on it unattended.

```
Source ──events──► Watcher (filter · batch · policy) ──► Action
GitHub PR                                              resume session with prompt
file system                                            create a new session
Telegram (later)                                       notify the user
schedule (later)
```

### 9.1 General
- **R-W-1** Watchers are attached to a session (or, for sources like Telegram, to a
  project with a "create new session" action). They are listed and can be
  paused/removed from the session header and a global Watchers view.
- **R-W-2** **Batching**: events are debounced and grouped so one wake-up handles
  them together (e.g. all review comments of one review; CI only after all
  checks completed).
- **R-W-3** **Busy sessions**: if the session is running or the user is mid-
  conversation, the trigger is queued and shown as a pending chip; it runs
  when the session becomes idle (the user can run or dismiss it earlier).
- **R-W-4** **Loop guards**: max automatic attempts per watcher per problem
  (default 3, e.g. the same failing check), per-watcher daily cap, and
  automatic pause when the same failure repeats unchanged. Hitting a guard
  escalates to the user.
- **R-W-5** **Outcome reporting**: each triggered turn ends with a structured
  outcome reported by the agent through an openc tool (§9.3): `resolved`,
  `needs_user` (with the list of pending items), or `failed`. `needs_user`
  and `failed` put the session in `waiting` and notify the user.
- **R-W-6** **Inbox**: a "Needs you" view listing every session waiting on the
  user, with the pending items and a link to the cause (comment, CI run).
- **R-W-7** **Catch-up**: watchers keep a cursor; after downtime they process what
  happened while openc was stopped (with batching, not one wake per event).
- **R-W-8** Triggered turns are clearly marked in the transcript (source, event,
  link), distinct from user messages.

### 9.2 GitHub PR watcher (first source)
- **R-W-GH-1** A PR can be linked to a session: automatically when openc opens the
  PR (R-DIFF-4) or when a PR's head is the session branch; manually ("watch
  PR #123 / URL"); or by the agent itself via an openc tool.
- **R-W-GH-2** Events handled:
  - **CI failure** (all checks completed, at least one failed): agent gets the
    failing checks and log excerpts, fixes, commits and pushes, then the
    watcher waits for the new CI run.
  - **Review / PR comments**: agent addresses each comment (code change and/or
    reply on GitHub); anything it can't or shouldn't decide alone is reported
    as `needs_user`.
  - **Merge conflict** with the base branch: agent rebases/merges and pushes,
    or escalates.
  - **PR merged or closed**: watcher stops, session auto-archived.
- **R-W-GH-3** **Author allow-list**: only comments from allowed authors trigger work
  (default: the user themself and repo collaborators with write access).
  Others are shown in the session but never sent to the agent automatically.
- **R-W-GH-4** All GitHub content is passed to the agent as clearly delimited
  untrusted data, never as instructions from the user.
- **R-W-GH-5** Push policy for triggered turns: push only to the session branch,
  never force-push, never merge the PR.
- **R-W-GH-6** Ignore events caused by the session itself (its own pushes and
  comments; openc tags comments it posts and tracks their ids).
- **R-W-GH-7** Uses the user's local `gh` authentication. Transport: polling (see
  ARCHITECTURE §8); no public endpoint required.

### 9.3 openc tools for agents
openc exposes a small tool set to every session (as an MCP server, so it works
across backends):
- `openc_report_outcome(status, summary, pending_items[])` — see R-W-5.
- `openc_watch_pr(pr)` / `openc_unwatch(…)` — the agent subscribes after opening a PR.
- `openc_notify_user(message)` — ask for attention without ending the turn.

### 9.4 Other sources
Watchers are a first-class, generic concept: any source that can emit events
plugs into the same engine, policies, inbox and UI. The GitHub PR source is
only the first. Examples of possible later sources (none committed yet):
file watcher (path globs → prompt), schedule (cron → prompt), chat channels
such as Telegram (message → new or existing session), generic incoming
webhook.

- **R-W-9** Adding a source requires only implementing the source interface and
  a prompt template; no changes to the engine, storage or UI.

### 9.5 Notifications
- **R-N-1** Browser notifications (MVP). A notification-channel abstraction so
  other channels (e.g. ntfy, email, chat apps) can be added later.

## 10. Constraints and risks

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
- **Prompt injection via watchers.** Triggered sessions run in never-ask mode and
  read external content (PR comments, CI logs, later Telegram). Mitigated by
  the author allow-list, untrusted-data framing, branch-only push policy and
  loop guards (R-W-*), but it remains the main risk of unattended operation.
- **Watchers need the server running.** Run openc as a `systemd --user` service
  (works on WSL with systemd enabled); catch-up covers downtime.
- **Unattended usage.** Auto-fix loops consume plan usage/credits; loop guards
  and daily caps bound it.

## 11. Milestones

| # | Scope |
|---|---|
| M0 | Spike: Agent SDK with subscription auth, streaming, interrupt, resume (incl. `sessionStore`), bypass mode, model list. Confirm worktree + snapshot approach. |
| M1 | Skeleton: server, web UI, sidebar, chat with Claude Code, persistence, folder picker, scratch sessions, release/resume. |
| M2 | Worktrees, parallel sessions, status badges, notifications, delete with warnings, archive. |
| M3 | Diff pane: session/last-turn views, line comments, commit/revert/merge/PR/discard. |
| M4 | Watchers: framework, GitHub PR watcher, openc tools for agents, inbox. |
| M5 | History view + search, usage display, images, plan mode/to-dos/subagents rendering, slash commands. |
| M6 | Codex adapter. |
| Later | More watcher sources and notification channels as needed, Pi adapter, shared MCP config, remote access (e.g. Tailscale), macOS. |
