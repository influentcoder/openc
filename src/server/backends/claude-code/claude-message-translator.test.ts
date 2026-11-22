import { describe, expect, it } from "vitest";
import type { BackendEvent } from "../backend-adapter.ts";
import { parseClaudeMessage } from "./claude-message-schema.ts";
import { ClaudeMessageTranslator } from "./claude-message-translator.ts";
import { fixtureTurns, loadClaudeFixture } from "./testing/claude-fixtures.ts";

function translateAll(messages: unknown[], translator = new ClaudeMessageTranslator()) {
  return messages.flatMap((raw): BackendEvent[] => {
    const parsed = parseClaudeMessage(raw);
    return parsed.kind === "handled" ? translator.translate(parsed.message) : [];
  });
}

function translateFixture(name: string) {
  return translateAll(fixtureTurns(loadClaudeFixture(name)).flatMap((turn) => turn.messages));
}

const streamedText = (events: BackendEvent[]) =>
  events.flatMap((event) => (event.type === "assistant.delta" ? [event.text] : [])).join("");

describe("ClaudeMessageTranslator", () => {
  it("streams a reply and ends the turn with usage including cached input", () => {
    expect(translateFixture("synthetic-pong")).toEqual([
      { type: "assistant.delta", messageId: "msg_pong:text-0", text: "p" },
      { type: "assistant.delta", messageId: "msg_pong:text-0", text: "ong" },
      { type: "assistant.message", messageId: "msg_pong:text-0", text: "pong" },
      { type: "usage", inputTokens: 10812, outputTokens: 40 },
      { type: "turn.completed", reason: "end", errorMessage: null },
    ]);
  });

  it("turns tool use into started and completed tool calls between text blocks", () => {
    const events = translateFixture("synthetic-tool-use");
    expect(events.filter((event) => event.type.startsWith("tool."))).toEqual([
      {
        type: "tool.started",
        toolCallId: "toolu_list",
        name: "Bash",
        kind: "execute",
        summary: "ls",
        input: { command: "ls", description: "List files in the current directory" },
      },
      {
        type: "tool.completed",
        toolCallId: "toolu_list",
        output: "README.md\nsrc",
        isError: false,
      },
    ]);
    expect(events.filter((event) => event.type === "assistant.message")).toEqual([
      { type: "assistant.message", messageId: "msg_list:text-0", text: "I'll list the files." },
      {
        type: "assistant.message",
        messageId: "msg_summary:text-0",
        text: "The directory contains README.md and src.",
      },
    ]);
    expect(streamedText(events)).toBe(
      "I'll list the files.The directory contains README.md and src.",
    );
  });

  it("reports an aborted turn as interrupted", () => {
    expect(translateFixture("synthetic-interrupted-count").at(-1)).toEqual({
      type: "turn.completed",
      reason: "interrupted",
      errorMessage: null,
    });
  });

  it("reports API errors once, through the failed turn", () => {
    const events = translateFixture("synthetic-api-error");
    expect(events.filter((event) => event.type === "assistant.message")).toEqual([]);
    expect(events.at(-1)).toMatchObject({
      type: "turn.completed",
      reason: "error",
      errorMessage: expect.stringContaining("Overloaded"),
    });
  });

  it("treats a turn as interrupted when an interrupt was requested, whatever the result says", () => {
    const translator = new ClaudeMessageTranslator();
    translator.noteInterruptRequested();
    const result = fixtureTurns(loadClaudeFixture("synthetic-pong"))[0]?.messages.at(-1);
    expect(translateAll([result], translator).at(-1)).toMatchObject({ reason: "interrupted" });
    expect(translateAll([result], translator).at(-1)).toMatchObject({ reason: "end" });
  });

  it("emits the whole text as one delta when the reply was not streamed", () => {
    const message = {
      type: "assistant",
      parent_tool_use_id: null,
      message: { id: "msg_plain", content: [{ type: "text", text: "Hello" }] },
    };
    expect(translateAll([message])).toEqual([
      { type: "assistant.delta", messageId: "msg_plain:text-0", text: "Hello" },
      { type: "assistant.message", messageId: "msg_plain:text-0", text: "Hello" },
    ]);
  });

  it("ignores messages from subagents", () => {
    const message = {
      type: "assistant",
      parent_tool_use_id: "toolu_task",
      message: { id: "msg_sub", content: [{ type: "text", text: "Subagent work" }] },
    };
    expect(translateAll([message])).toEqual([]);
  });

  it("separates handled, ignored and invalid messages", () => {
    expect(parseClaudeMessage({ type: "rate_limit_event" })).toEqual({
      kind: "ignored",
      type: "rate_limit_event",
    });
    expect(parseClaudeMessage({ type: "result", subtype: "success" })).toMatchObject({
      kind: "invalid",
      type: "result",
    });
    expect(parseClaudeMessage("not a message")).toMatchObject({ kind: "invalid" });
  });
});
