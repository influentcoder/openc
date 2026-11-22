import type { BackendEvent } from "../backend-adapter.ts";
import type { ClaudeMessage, ClaudeResultMessage } from "./claude-message-schema.ts";
import { limitToolOutput, summarizeToolInput, toolKindOf } from "./tool-presentation.ts";

type AssistantMessage = Extract<ClaudeMessage, { type: "assistant" }>;
type UserMessage = Extract<ClaudeMessage, { type: "user" }>;
type StreamEvent = Extract<ClaudeMessage, { type: "stream_event" }>;
type ContentBlock = AssistantMessage["message"]["content"][number];

const interruptedTerminalReasons = new Set(["aborted_streaming", "aborted_tools"]);

export class ClaudeMessageTranslator {
  private streamingMessageId: string | null = null;
  private readonly textKeysByBlockIndex = new Map<number, string>();
  private readonly startedTextBlocks = new Map<string, number>();
  private readonly finishedTextBlocks = new Map<string, number>();
  private readonly streamedTextKeys = new Set<string>();
  private interruptRequested = false;

  noteInterruptRequested(): void {
    this.interruptRequested = true;
  }

  translate(message: ClaudeMessage): BackendEvent[] {
    if (
      message.type !== "result" &&
      message.type !== "system" &&
      message.parent_tool_use_id !== null
    ) {
      return [];
    }
    switch (message.type) {
      case "stream_event":
        return this.translateStreamEvent(message);
      case "assistant":
        return this.translateAssistantMessage(message);
      case "user":
        return translateToolResults(message);
      case "result":
        return this.translateResult(message);
      case "system":
        return [];
    }
  }

  private translateStreamEvent({ event }: StreamEvent): BackendEvent[] {
    switch (event.kind) {
      case "message_start":
        this.streamingMessageId = event.messageId;
        this.textKeysByBlockIndex.clear();
        return [];
      case "text_block_start":
        if (this.streamingMessageId) {
          const key = nextTextKey(this.startedTextBlocks, this.streamingMessageId);
          this.textKeysByBlockIndex.set(event.index, key);
        }
        return [];
      case "text_delta":
        return this.translateTextDelta(event.index, event.text);
      case "other":
        return [];
    }
  }

  private translateTextDelta(blockIndex: number, text: string): BackendEvent[] {
    const key = this.textKeysByBlockIndex.get(blockIndex);
    if (!key) {
      return [];
    }
    this.streamedTextKeys.add(key);
    return [{ type: "assistant.delta", messageId: key, text }];
  }

  private translateAssistantMessage({ message, error }: AssistantMessage): BackendEvent[] {
    if (error !== undefined) {
      return [];
    }
    return message.content.flatMap((block) => this.translateContentBlock(message.id, block));
  }

  private translateContentBlock(apiMessageId: string, block: ContentBlock): BackendEvent[] {
    switch (block.kind) {
      case "text":
        return this.translateFinishedText(apiMessageId, block.text);
      case "tool_use":
        return [
          {
            type: "tool.started",
            toolCallId: block.id,
            name: block.name,
            kind: toolKindOf(block.name),
            summary: summarizeToolInput(block.name, block.input),
            input: block.input,
          },
        ];
      case "other":
        return [];
    }
  }

  private translateFinishedText(apiMessageId: string, text: string): BackendEvent[] {
    const key = nextTextKey(this.finishedTextBlocks, apiMessageId);
    if (text.length === 0) {
      return [];
    }
    const delta: BackendEvent[] = this.streamedTextKeys.has(key)
      ? []
      : [{ type: "assistant.delta", messageId: key, text }];
    return [...delta, { type: "assistant.message", messageId: key, text }];
  }

  private translateResult(result: ClaudeResultMessage): BackendEvent[] {
    const interrupted =
      this.interruptRequested || interruptedTerminalReasons.has(result.terminal_reason ?? "");
    this.resetTurnState();
    const usage: BackendEvent = {
      type: "usage",
      inputTokens:
        result.usage.input_tokens +
        (result.usage.cache_creation_input_tokens ?? 0) +
        (result.usage.cache_read_input_tokens ?? 0),
      outputTokens: result.usage.output_tokens,
    };
    if (interrupted) {
      return [usage, { type: "turn.completed", reason: "interrupted", errorMessage: null }];
    }
    if (result.is_error || result.subtype !== "success") {
      return [
        usage,
        { type: "turn.completed", reason: "error", errorMessage: describeFailure(result) },
      ];
    }
    return [usage, { type: "turn.completed", reason: "end", errorMessage: null }];
  }

  private resetTurnState(): void {
    this.interruptRequested = false;
    this.streamingMessageId = null;
    this.textKeysByBlockIndex.clear();
    this.startedTextBlocks.clear();
    this.finishedTextBlocks.clear();
    this.streamedTextKeys.clear();
  }
}

function nextTextKey(counters: Map<string, number>, apiMessageId: string): string {
  const ordinal = counters.get(apiMessageId) ?? 0;
  counters.set(apiMessageId, ordinal + 1);
  return `${apiMessageId}:text-${ordinal}`;
}

function translateToolResults({ message }: UserMessage): BackendEvent[] {
  return message.content.flatMap((block): BackendEvent[] =>
    block.kind === "tool_result"
      ? [
          {
            type: "tool.completed",
            toolCallId: block.toolUseId,
            output: limitToolOutput(block.output),
            isError: block.isError,
          },
        ]
      : [],
  );
}

function describeFailure(result: ClaudeResultMessage): string {
  const details = result.errors?.filter((error) => error.length > 0) ?? [];
  if (details.length > 0) {
    return details.join("; ");
  }
  return result.result && result.result.length > 0
    ? result.result
    : `Claude Code failed (${result.subtype})`;
}
