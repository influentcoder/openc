import { desc, eq, inArray } from "drizzle-orm";
import type { SessionId } from "../../shared/ids.ts";
import type { AppDatabase } from "../db/open-database.ts";
import { sessions } from "../db/schema.ts";
import { type SessionChanges, type SessionRecord, SessionRecordSchema } from "./session-record.ts";

export class SessionNotFoundError extends Error {
  constructor(sessionId: SessionId) {
    super(`Session ${sessionId} not found`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionRepository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  insert(record: SessionRecord): void {
    this.database.insert(sessions).values(record).run();
  }

  find(sessionId: SessionId): SessionRecord | undefined {
    const row = this.database.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    return row ? SessionRecordSchema.parse(row) : undefined;
  }

  get(sessionId: SessionId): SessionRecord {
    const record = this.find(sessionId);
    if (!record) {
      throw new SessionNotFoundError(sessionId);
    }
    return record;
  }

  listByRecentActivity(): SessionRecord[] {
    return this.database
      .select()
      .from(sessions)
      .orderBy(desc(sessions.lastActivityAt))
      .all()
      .map((row) => SessionRecordSchema.parse(row));
  }

  update(sessionId: SessionId, changes: SessionChanges): SessionRecord {
    this.database.update(sessions).set(changes).where(eq(sessions.id, sessionId)).run();
    return this.get(sessionId);
  }

  delete(sessionId: SessionId): void {
    this.database.delete(sessions).where(eq(sessions.id, sessionId)).run();
  }

  listWithStatus(statuses: SessionRecord["status"][]): SessionRecord[] {
    return this.database
      .select()
      .from(sessions)
      .where(inArray(sessions.status, statuses))
      .all()
      .map((row) => SessionRecordSchema.parse(row));
  }

  markAllProcessesReleased(): void {
    this.database.update(sessions).set({ processState: "released" }).run();
  }

  recentDirectories(limit: number): string[] {
    const rows = this.database
      .selectDistinct({ path: sessions.workingDirectory })
      .from(sessions)
      .where(eq(sessions.workspaceMode, "directory"))
      .orderBy(desc(sessions.lastActivityAt))
      .limit(limit)
      .all();
    return rows.map((row) => row.path);
  }
}
