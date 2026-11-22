import type { EventEnvelope, HarnessEvent, ToolKind } from "../../shared/events.ts";
import type { AssistantDelta } from "../../shared/live-protocol.ts";

export type TranscriptItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string; streaming: boolean }
  | {
      kind: "tool";
      id: string;
      name: string;
      toolKind: ToolKind;
      summary: string;
      output: string | null;
      isError: boolean;
    }
  | { kind: "notice"; id: string; tone: "info" | "warning" | "error"; text: string };

export interface TranscriptState {
  lastSeq: number;
  items: TranscriptItem[];
}

export const emptyTranscript: TranscriptState = { lastSeq: 0, items: [] };

export function applyEnvelope(state: TranscriptState, envelope: EventEnvelope): TranscriptState {
  if (envelope.seq <= state.lastSeq) {
    return state;
  }
  return { lastSeq: envelope.seq, items: applyEvent(state.items, envelope.event, envelope.seq) };
}

export function applyDelta(state: TranscriptState, delta: AssistantDelta): TranscriptState {
  const existing = state.items.find((item) => item.id === delta.messageId);
  if (existing?.kind === "assistant" && !existing.streaming) {
    return state;
  }
  const items = existing
    ? state.items.map((item) =>
        item.id === delta.messageId && item.kind === "assistant"
          ? { ...item, text: item.text + delta.text }
          : item,
      )
    : [
        ...state.items,
        { kind: "assistant" as const, id: delta.messageId, text: delta.text, streaming: true },
      ];
  return { ...state, items };
}

function applyEvent(items: TranscriptItem[], event: HarnessEvent, seq: number): TranscriptItem[] {
  switch (event.type) {
    case "turn.started":
      return [...items, { kind: "user", id: event.turnId, text: event.text }];
    case "assistant.message":
      return upsert(items, {
        kind: "assistant",
        id: event.messageId,
        text: event.text,
        streaming: false,
      });
    case "tool.started":
      return [...items, toolItem(event)];
    case "tool.completed":
      return items.map((item) =>
        item.kind === "tool" && item.id === event.toolCallId
          ? { ...item, output: event.output, isError: event.isError }
          : item,
      );
    case "turn.completed":
      return [...stopStreaming(items), ...turnEndNotice(event, seq)];
    case "backend.started":
      return event.resumed ? [...items, notice(seq, "info", "Agent session resumed")] : items;
    case "context.rebuilt":
      return [...items, notice(seq, "warning", event.reason)];
    case "usage":
      return items;
  }
}

function toolItem(event: Extract<HarnessEvent, { type: "tool.started" }>): TranscriptItem {
  return {
    kind: "tool",
    id: event.toolCallId,
    name: event.name,
    toolKind: event.kind,
    summary: event.summary,
    output: null,
    isError: false,
  };
}

function upsert(items: TranscriptItem[], replacement: TranscriptItem): TranscriptItem[] {
  return items.some((item) => item.id === replacement.id)
    ? items.map((item) => (item.id === replacement.id ? replacement : item))
    : [...items, replacement];
}

function stopStreaming(items: TranscriptItem[]): TranscriptItem[] {
  return items.map((item) =>
    item.kind === "assistant" && item.streaming ? { ...item, streaming: false } : item,
  );
}

function turnEndNotice(
  event: Extract<HarnessEvent, { type: "turn.completed" }>,
  seq: number,
): TranscriptItem[] {
  if (event.reason === "interrupted") {
    return [notice(seq, "info", "Interrupted")];
  }
  if (event.reason === "error") {
    return [notice(seq, "error", event.errorMessage ?? "The turn failed")];
  }
  return [];
}

function notice(seq: number, tone: "info" | "warning" | "error", text: string): TranscriptItem {
  return { kind: "notice", id: `notice-${seq}`, tone, text };
}
