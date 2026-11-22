import { describe, expect, it } from "vitest";
import type { HarnessEvent } from "../../shared/events.ts";
import { SessionIdSchema, TurnIdSchema } from "../../shared/ids.ts";
import {
  applyDelta,
  applyEnvelope,
  emptyTranscript,
  type TranscriptState,
} from "./transcript-state.ts";

const sessionId = SessionIdSchema.parse("session-1");
const turnId = TurnIdSchema.parse("turn-1");

function applyEvents(events: HarnessEvent[], state: TranscriptState = emptyTranscript) {
  return events.reduce(
    (current, event) =>
      applyEnvelope(current, {
        sessionId,
        seq: current.lastSeq + 1,
        timestamp: "2026-01-01T00:00:00.000Z",
        event,
      }),
    state,
  );
}

const delta = (messageId: string, text: string) => ({ sessionId, turnId, messageId, text });

describe("transcript state", () => {
  it("shows the user message, streams the reply and settles on the final message", () => {
    let state = applyEvents([{ type: "turn.started", turnId, text: "hi" }]);
    state = applyDelta(state, delta("m1", "Hel"));
    state = applyDelta(state, delta("m1", "lo"));
    expect(state.items.at(-1)).toEqual({
      kind: "assistant",
      id: "m1",
      text: "Hello",
      streaming: true,
    });
    state = applyEvents(
      [{ type: "assistant.message", turnId, messageId: "m1", text: "Hello" }],
      state,
    );
    expect(state.items).toEqual([
      { kind: "user", id: "turn-1", text: "hi" },
      { kind: "assistant", id: "m1", text: "Hello", streaming: false },
    ]);
  });

  it("ignores events it has already applied", () => {
    const envelope = {
      sessionId,
      seq: 1,
      timestamp: "2026-01-01T00:00:00.000Z",
      event: { type: "turn.started" as const, turnId, text: "hi" },
    };
    const once = applyEnvelope(emptyTranscript, envelope);
    expect(applyEnvelope(once, envelope)).toBe(once);
  });

  it("ignores late deltas for a finished message", () => {
    const state = applyEvents([
      { type: "assistant.message", turnId, messageId: "m1", text: "Done" },
    ]);
    expect(applyDelta(state, delta("m1", "late"))).toBe(state);
  });

  it("fills in tool output when the tool completes", () => {
    const state = applyEvents([
      {
        type: "tool.started",
        turnId,
        toolCallId: "t1",
        name: "Bash",
        kind: "execute",
        summary: "ls",
        input: {},
      },
      { type: "tool.completed", turnId, toolCallId: "t1", output: "README.md", isError: false },
    ]);
    expect(state.items).toEqual([
      {
        kind: "tool",
        id: "t1",
        name: "Bash",
        toolKind: "execute",
        summary: "ls",
        output: "README.md",
        isError: false,
      },
    ]);
  });

  it("stops streaming and adds a notice when a turn is interrupted or fails", () => {
    let state = applyDelta(emptyTranscript, delta("m1", "partial"));
    state = applyEvents(
      [{ type: "turn.completed", turnId, reason: "interrupted", errorMessage: null }],
      state,
    );
    expect(state.items).toEqual([
      { kind: "assistant", id: "m1", text: "partial", streaming: false },
      { kind: "notice", id: "notice-1", tone: "info", text: "Interrupted" },
    ]);
    state = applyEvents(
      [{ type: "turn.completed", turnId, reason: "error", errorMessage: "Boom" }],
      state,
    );
    expect(state.items.at(-1)).toMatchObject({ tone: "error", text: "Boom" });
  });

  it("tells the user when the agent session was resumed or lost its context", () => {
    const state = applyEvents([
      { type: "backend.started", backendSessionId: "b1", resumed: false },
      { type: "backend.started", backendSessionId: "b1", resumed: true },
      { type: "context.rebuilt", reason: "Context lost" },
    ]);
    expect(state.items.map((item) => (item.kind === "notice" ? item.text : item.kind))).toEqual([
      "Agent session resumed",
      "Context lost",
    ]);
  });
});
