# Claude Code fixtures

Message streams from the Claude Agent SDK, replayed by
`FakeClaudeAgentClient` in tests. One JSON object per line:

- `{"direction": "in", "text": "..."}`: a prompt openc sent.
- `{"direction": "out", "message": {...}}`: a message the SDK emitted.

## Synthetic vs recorded

`synthetic-*.jsonl` were written by hand from the SDK's type definitions
because no Claude login was available when the adapter was built. Replace
them with real recordings as soon as possible:

```sh
OPENC_RECORD_CLAUDE_FIXTURES=fixtures/claude-code/recorded pnpm test:contract:live
```

The recorder replaces the working directory and home directory with
placeholders and keeps only the `type`, `subtype`, `session_id` and `model` of
system messages. Review a recording before committing it.
