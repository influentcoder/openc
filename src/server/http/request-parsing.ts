import type { Context } from "hono";
import type { z } from "zod";
import { type SessionId, SessionIdSchema } from "../../shared/ids.ts";
import { BadRequestError } from "./error-responses.ts";

export async function parseJsonBody<Schema extends z.ZodType>(
  context: Context,
  schema: Schema,
): Promise<z.infer<Schema>> {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

export function sessionIdParameter(context: Context): SessionId {
  return SessionIdSchema.parse(context.req.param("sessionId"));
}
