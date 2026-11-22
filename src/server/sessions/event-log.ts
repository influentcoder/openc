import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { type EventEnvelope, EventEnvelopeSchema, type HarnessEvent } from "../../shared/events.ts";
import type { SessionId, TurnId } from "../../shared/ids.ts";
import type { AppDatabase } from "../db/open-database.ts";
import { events } from "../db/schema.ts";
import type { Clock } from "../platform/clock.ts";

type EventRow = typeof events.$inferSelect;

export class EventLog {
  private readonly database: AppDatabase;
  private readonly clock: Clock;
  private readonly lastSeqBySession = new Map<SessionId, number>();

  constructor(database: AppDatabase, clock: Clock) {
    this.database = database;
    this.clock = clock;
  }

  append(sessionId: SessionId, event: HarnessEvent): EventEnvelope {
    const seq = this.lastSeq(sessionId) + 1;
    const envelope: EventEnvelope = {
      sessionId,
      seq,
      timestamp: this.clock.now().toISOString(),
      event,
    };
    this.database
      .insert(events)
      .values({
        sessionId,
        seq,
        timestamp: envelope.timestamp,
        type: event.type,
        payload: JSON.stringify(event),
      })
      .run();
    this.lastSeqBySession.set(sessionId, seq);
    return envelope;
  }

  listSince(sessionId: SessionId, sinceSeq: number): EventEnvelope[] {
    return this.database
      .select()
      .from(events)
      .where(and(eq(events.sessionId, sessionId), gt(events.seq, sinceSeq)))
      .orderBy(events.seq)
      .all()
      .map(toEnvelope);
  }

  findOpenTurn(sessionId: SessionId): TurnId | null {
    const lastTurnEvent = this.database
      .select()
      .from(events)
      .where(
        and(
          eq(events.sessionId, sessionId),
          inArray(events.type, ["turn.started", "turn.completed"]),
        ),
      )
      .orderBy(desc(events.seq))
      .limit(1)
      .get();
    const event = lastTurnEvent ? toEnvelope(lastTurnEvent).event : undefined;
    return event?.type === "turn.started" ? event.turnId : null;
  }

  forget(sessionId: SessionId): void {
    this.lastSeqBySession.delete(sessionId);
  }

  private lastSeq(sessionId: SessionId): number {
    const cached = this.lastSeqBySession.get(sessionId);
    if (cached !== undefined) {
      return cached;
    }
    const lastRow = this.database
      .select({ seq: events.seq })
      .from(events)
      .where(eq(events.sessionId, sessionId))
      .orderBy(desc(events.seq))
      .limit(1)
      .get();
    return lastRow?.seq ?? 0;
  }
}

function toEnvelope(row: EventRow): EventEnvelope {
  return EventEnvelopeSchema.parse({
    sessionId: row.sessionId,
    seq: row.seq,
    timestamp: row.timestamp,
    event: JSON.parse(row.payload),
  });
}
