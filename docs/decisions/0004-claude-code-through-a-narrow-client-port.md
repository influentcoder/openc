# 0004 — Claude Code through a narrow client port

**Context.** The Claude Agent SDK's `Query` object has dozens of methods and
its message union keeps growing. Tests must not need a Claude login, and the
SDK's output is external input that can change shape between releases.

**Decision.**

- The adapter depends on `ClaudeAgentClient`, a three-method port (open a
  conversation, check that one exists, describe the account). Only
  `SdkClaudeAgentClient` imports the SDK.
- Every SDK message is treated as `unknown` and validated by a Zod schema that
  covers only what openc uses and normalizes it into internal shapes. Unknown
  message types are ignored; known types that fail validation are logged, not
  translated.
- Translation is a pure, stateful class tested against fixture streams.
- The same backend contract suite runs against the adapter on the fake client
  (`pnpm check`) and on the real SDK (`pnpm test:contract:live`), which can
  also record new fixtures.
- The first fixtures are synthetic (written from the SDK type definitions)
  because no login was available; they are named `synthetic-*` and must be
  replaced by recordings.

**Consequences.** SDK upgrades touch two files (client and schema). Until real
recordings exist, the fake may disagree with Claude Code in details; the live
contract run is the check for that.
