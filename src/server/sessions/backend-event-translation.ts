import type { HarnessEvent } from "../../shared/events.ts";
import type { TurnId } from "../../shared/ids.ts";
import type { BackendEvent } from "../backends/backend-adapter.ts";

type PersistedBackendEvent = Exclude<BackendEvent, { type: "assistant.delta" }>;

export function toHarnessEvent(event: PersistedBackendEvent, turnId: TurnId): HarnessEvent {
  return { ...event, turnId };
}
