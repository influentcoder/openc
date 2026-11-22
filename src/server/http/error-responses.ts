import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { UnknownBackendError } from "../backends/backend-registry.ts";
import type { Logger } from "../platform/logger.ts";
import {
  LiveProcessLimitError,
  SessionBusyError,
  UnknownModelError,
} from "../sessions/session-errors.ts";
import { SessionNotFoundError } from "../sessions/session-repository.ts";
import { PathNotFoundError, PathOutsideRootError } from "../workspace/path-guard.ts";

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

const statusByErrorType: [new (...parameters: never[]) => Error, ContentfulStatusCode][] = [
  [SessionNotFoundError, 404],
  [BadRequestError, 400],
  [UnknownBackendError, 400],
  [UnknownModelError, 400],
  [PathOutsideRootError, 400],
  [PathNotFoundError, 400],
  [SessionBusyError, 409],
  [LiveProcessLimitError, 409],
];

export function respondToError(error: Error, context: Context, logger: Logger): Response {
  if (error instanceof ZodError) {
    return context.json(
      { error: `Invalid request: ${error.issues[0]?.message ?? "unknown"}` },
      400,
    );
  }
  const knownStatus = statusByErrorType.find(([errorType]) => error instanceof errorType)?.[1];
  if (knownStatus) {
    return context.json({ error: error.message }, knownStatus);
  }
  logger.error({ error, path: context.req.path }, "Unhandled request error");
  return context.json({ error: "Internal server error" }, 500);
}
