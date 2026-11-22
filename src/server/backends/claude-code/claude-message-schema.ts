import { z } from "zod";

const OtherSchema = z
  .looseObject({ type: z.string() })
  .transform(() => ({ kind: "other" as const }));

const ContentBlockSchema = z.union([
  z
    .object({ type: z.literal("text"), text: z.string() })
    .transform((block) => ({ kind: "text" as const, text: block.text })),
  z
    .object({ type: z.literal("tool_use"), id: z.string(), name: z.string(), input: z.unknown() })
    .transform((block) => ({
      kind: "tool_use" as const,
      id: block.id,
      name: block.name,
      input: block.input,
    })),
  OtherSchema,
]);

const ToolResultTextSchema = z.union([
  z.string(),
  z
    .array(
      z.union([
        z.object({ type: z.literal("text"), text: z.string() }).transform((block) => block.text),
        z.looseObject({ type: z.string() }).transform((block) => `[${block.type}]`),
      ]),
    )
    .transform((parts) => parts.join("\n")),
]);

const UserContentBlockSchema = z.union([
  z
    .object({
      type: z.literal("tool_result"),
      tool_use_id: z.string(),
      content: ToolResultTextSchema.optional(),
      is_error: z.boolean().optional(),
    })
    .transform((block) => ({
      kind: "tool_result" as const,
      toolUseId: block.tool_use_id,
      output: block.content ?? "",
      isError: block.is_error === true,
    })),
  OtherSchema,
]);

const StreamEventBodySchema = z.union([
  z
    .object({ type: z.literal("message_start"), message: z.object({ id: z.string() }) })
    .transform((event) => ({ kind: "message_start" as const, messageId: event.message.id })),
  z
    .object({
      type: z.literal("content_block_start"),
      index: z.number(),
      content_block: z.object({ type: z.literal("text") }),
    })
    .transform((event) => ({ kind: "text_block_start" as const, index: event.index })),
  z
    .object({
      type: z.literal("content_block_delta"),
      index: z.number(),
      delta: z.object({ type: z.literal("text_delta"), text: z.string() }),
    })
    .transform((event) => ({
      kind: "text_delta" as const,
      index: event.index,
      text: event.delta.text,
    })),
  OtherSchema,
]);

const parentToolUseId = z.string().nullable();

export const ClaudeMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("assistant"),
    parent_tool_use_id: parentToolUseId,
    error: z.string().optional(),
    message: z.object({ id: z.string(), content: z.array(ContentBlockSchema) }),
  }),
  z.object({
    type: z.literal("user"),
    parent_tool_use_id: parentToolUseId,
    message: z.object({
      content: z.union([z.string().transform(() => []), z.array(UserContentBlockSchema)]),
    }),
  }),
  z.object({
    type: z.literal("stream_event"),
    parent_tool_use_id: parentToolUseId,
    event: StreamEventBodySchema,
  }),
  z.object({
    type: z.literal("result"),
    subtype: z.string(),
    is_error: z.boolean(),
    result: z.string().optional(),
    errors: z.array(z.string()).optional(),
    terminal_reason: z.string().optional(),
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().nullish(),
      cache_read_input_tokens: z.number().nullish(),
    }),
  }),
  z.looseObject({ type: z.literal("system"), subtype: z.string() }),
]);
export type ClaudeMessage = z.output<typeof ClaudeMessageSchema>;
export type ClaudeResultMessage = Extract<ClaudeMessage, { type: "result" }>;

const handledTypes = new Set(["assistant", "user", "stream_event", "result", "system"]);

export type ParsedClaudeMessage =
  | { kind: "handled"; message: ClaudeMessage }
  | { kind: "ignored"; type: string }
  | { kind: "invalid"; type: string; problem: string };

export function parseClaudeMessage(raw: unknown): ParsedClaudeMessage {
  const typed = z.looseObject({ type: z.string() }).safeParse(raw);
  if (!typed.success) {
    return { kind: "invalid", type: "unknown", problem: "Message has no type" };
  }
  if (!handledTypes.has(typed.data.type)) {
    return { kind: "ignored", type: typed.data.type };
  }
  const parsed = ClaudeMessageSchema.safeParse(raw);
  return parsed.success
    ? { kind: "handled", message: parsed.data }
    : { kind: "invalid", type: typed.data.type, problem: z.prettifyError(parsed.error) };
}
