# 0003 — Sessions outlive agent processes

**Context.** Users keep many sessions around. Keeping an agent process per
session alive forever wastes memory; killing sessions loses work.

**Decision.** A session (metadata + event log) is permanent until deleted; the
backend process is transient. `LiveProcesses` starts or resumes a process on
demand, releases it after 10 idle minutes (never while the session is being
viewed), and evicts the least recently used idle process when the live-process
limit is reached. If the backend no longer knows the conversation, a fresh
backend session starts and a `context.rebuilt` event is recorded.

The UI never needs the process to show a session: transcripts come from
openc's own event log, streamed over the WebSocket with backlog replay by
sequence number.

**Consequences.** Resuming costs a few seconds and, after a long pause, a
full context re-read by the model. Restoring context when the backend lost it
(summary seeding, transcript mirroring) is future work tracked in R-SES-17.
