import { type BackendSession, BackendSessionNotFoundError } from "../backends/backend-adapter.ts";
import type { BackendRegistry } from "../backends/backend-registry.ts";
import type { SessionRecord } from "./session-record.ts";
import type { SessionRecorder } from "./session-recorder.ts";

export const contextLostReason =
  "The backend no longer had this conversation, so it continues in a fresh backend session without the earlier context.";

export async function openBackendSession(
  record: SessionRecord,
  backends: BackendRegistry,
  recorder: SessionRecorder,
): Promise<BackendSession> {
  const adapter = backends.get(record.backendId);
  const options = { workingDirectory: record.workingDirectory, model: record.model };
  if (record.backendSessionId !== null) {
    try {
      const resumed = await adapter.resume({
        ...options,
        backendSessionId: record.backendSessionId,
      });
      recordStart(record, resumed, true, recorder);
      return resumed;
    } catch (error) {
      if (!(error instanceof BackendSessionNotFoundError)) {
        throw error;
      }
      recorder.append(record.id, { type: "context.rebuilt", reason: contextLostReason });
    }
  }
  const started = await adapter.start(options);
  recordStart(record, started, false, recorder);
  return started;
}

function recordStart(
  record: SessionRecord,
  backendSession: BackendSession,
  resumed: boolean,
  recorder: SessionRecorder,
): void {
  recorder.append(record.id, {
    type: "backend.started",
    backendSessionId: backendSession.backendSessionId,
    resumed,
  });
}
