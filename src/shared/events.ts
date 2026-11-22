import { z } from "zod";
import { SessionIdSchema, TurnIdSchema } from "./ids.ts";

export const ToolKindSchema = z.enum(["read", "edit", "execute", "search", "fetch", "other"]);
export type ToolKind = z.infer<typeof ToolKindSchema>;

export const TurnEndReasonSchema = z.enum(["end", "interrupted", "error"]);
export type TurnEndReason = z.infer<typeof TurnEndReasonSchema>;

const TurnStartedSchema = z.object({
  type: z.literal("turn.started"),
  turnId: TurnIdSchema,
  text: z.string(),
});

const AssistantMessageSchema = z.object({
  type: z.literal("assistant.message"),
  turnId: TurnIdSchema,
  messageId: z.string(),
  text: z.string(),
});

const ToolStartedSchema = z.object({
  type: z.literal("tool.started"),
  turnId: TurnIdSchema,
  toolCallId: z.string(),
  name: z.string(),
  kind: ToolKindSchema,
  summary: z.string(),
  input: z.unknown(),
});

const ToolCompletedSchema = z.object({
  type: z.literal("tool.completed"),
  turnId: TurnIdSchema,
  toolCallId: z.string(),
  output: z.string(),
  isError: z.boolean(),
});

const UsageSchema = z.object({
  type: z.literal("usage"),
  turnId: TurnIdSchema,
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

const TurnCompletedSchema = z.object({
  type: z.literal("turn.completed"),
  turnId: TurnIdSchema,
  reason: TurnEndReasonSchema,
  errorMessage: z.string().nullable(),
});

const BackendStartedSchema = z.object({
  type: z.literal("backend.started"),
  backendSessionId: z.string(),
  resumed: z.boolean(),
});

const ContextRebuiltSchema = z.object({
  type: z.literal("context.rebuilt"),
  reason: z.string(),
});

export const HarnessEventSchema = z.discriminatedUnion("type", [
  TurnStartedSchema,
  AssistantMessageSchema,
  ToolStartedSchema,
  ToolCompletedSchema,
  UsageSchema,
  TurnCompletedSchema,
  BackendStartedSchema,
  ContextRebuiltSchema,
]);
export type HarnessEvent = z.infer<typeof HarnessEventSchema>;

export const EventEnvelopeSchema = z.object({
  sessionId: SessionIdSchema,
  seq: z.number().int().positive(),
  timestamp: z.iso.datetime(),
  event: HarnessEventSchema,
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
