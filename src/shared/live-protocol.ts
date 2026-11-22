import { z } from "zod";
import { EventEnvelopeSchema } from "./events.ts";
import { SessionIdSchema, TurnIdSchema } from "./ids.ts";
import { SessionSummarySchema } from "./session.ts";

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    sessionId: SessionIdSchema,
    sinceSeq: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal("unsubscribe"), sessionId: SessionIdSchema }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const AssistantDeltaSchema = z.object({
  sessionId: SessionIdSchema,
  turnId: TurnIdSchema,
  messageId: z.string(),
  text: z.string(),
});
export type AssistantDelta = z.infer<typeof AssistantDeltaSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.event"), envelope: EventEnvelopeSchema }),
  z.object({ type: z.literal("session.delta"), delta: AssistantDeltaSchema }),
  z.object({ type: z.literal("session.updated"), session: SessionSummarySchema }),
  z.object({ type: z.literal("session.deleted"), sessionId: SessionIdSchema }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
