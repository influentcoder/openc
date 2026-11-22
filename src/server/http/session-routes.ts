import { Hono } from "hono";
import {
  CreateSessionRequestSchema,
  RenameSessionRequestSchema,
  SendMessageRequestSchema,
} from "../../shared/api.ts";
import type { SessionManager } from "../sessions/session-manager.ts";
import { parseJsonBody, sessionIdParameter } from "./request-parsing.ts";

export function sessionRoutes(sessions: SessionManager): Hono {
  return new Hono()
    .get("/", (context) => context.json(sessions.list()))
    .post("/", async (context) => {
      const request = await parseJsonBody(context, CreateSessionRequestSchema);
      return context.json(await sessions.create(request), 201);
    })
    .get("/:sessionId", (context) => context.json(sessions.get(sessionIdParameter(context))))
    .patch("/:sessionId", async (context) => {
      const { title } = await parseJsonBody(context, RenameSessionRequestSchema);
      return context.json(sessions.rename(sessionIdParameter(context), title));
    })
    .delete("/:sessionId", async (context) => {
      await sessions.delete(sessionIdParameter(context));
      return context.body(null, 204);
    })
    .post("/:sessionId/messages", async (context) => {
      const { text } = await parseJsonBody(context, SendMessageRequestSchema);
      const turnId = await sessions.sendMessage(sessionIdParameter(context), text);
      return context.json({ turnId }, 202);
    })
    .post("/:sessionId/interrupt", async (context) => {
      await sessions.interrupt(sessionIdParameter(context));
      return context.body(null, 202);
    });
}
