import type { EventEnvelope, HarnessEvent } from "../../shared/events.ts";
import type { SessionId } from "../../shared/ids.ts";
import type { AssistantDelta } from "../../shared/live-protocol.ts";
import type { Clock } from "../platform/clock.ts";
import type { EventLog } from "./event-log.ts";
import type { SessionNotifications } from "./session-notifications.ts";
import { type SessionChanges, type SessionRecord, toSummary } from "./session-record.ts";
import type { SessionRepository } from "./session-repository.ts";

export class SessionRecorder {
  private readonly repository: SessionRepository;
  private readonly eventLog: EventLog;
  private readonly notifications: SessionNotifications;
  private readonly clock: Clock;

  constructor(
    repository: SessionRepository,
    eventLog: EventLog,
    notifications: SessionNotifications,
    clock: Clock,
  ) {
    this.repository = repository;
    this.eventLog = eventLog;
    this.notifications = notifications;
    this.clock = clock;
  }

  update(sessionId: SessionId, changes: SessionChanges): SessionRecord {
    const record = this.repository.update(sessionId, changes);
    this.notifications.publish({ type: "session.updated", session: toSummary(record) });
    return record;
  }

  recordActivity(sessionId: SessionId, changes: SessionChanges): SessionRecord {
    return this.update(sessionId, { ...changes, lastActivityAt: this.clock.now().toISOString() });
  }

  append(sessionId: SessionId, event: HarnessEvent): EventEnvelope {
    const envelope = this.eventLog.append(sessionId, event);
    this.notifications.publish({ type: "session.event", envelope });
    return envelope;
  }

  publishDelta(delta: AssistantDelta): void {
    this.notifications.publish({ type: "session.delta", delta });
  }
}
