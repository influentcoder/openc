import type { SessionId } from "../../shared/ids.ts";

export class SessionBusyError extends Error {
  constructor(sessionId: SessionId) {
    super(`Session ${sessionId} is already working on a turn`);
    this.name = "SessionBusyError";
  }
}

export class LiveProcessLimitError extends Error {
  constructor(limit: number) {
    super(`All ${limit} live agent processes are busy; wait for one to finish`);
    this.name = "LiveProcessLimitError";
  }
}

export class UnknownModelError extends Error {
  constructor(model: string) {
    super(`Unknown model: ${model}`);
    this.name = "UnknownModelError";
  }
}

export function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
