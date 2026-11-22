import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  backendId: text("backend_id").notNull(),
  model: text("model").notNull(),
  workspaceMode: text("workspace_mode").notNull(),
  workingDirectory: text("working_directory").notNull(),
  status: text("status").notNull(),
  processState: text("process_state").notNull(),
  errorMessage: text("error_message"),
  backendSessionId: text("backend_session_id"),
  createdAt: text("created_at").notNull(),
  lastActivityAt: text("last_activity_at").notNull(),
});

export const events = sqliteTable(
  "events",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    timestamp: text("timestamp").notNull(),
    type: text("type").notNull(),
    payload: text("payload").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.seq] }),
    index("events_type_index").on(table.sessionId, table.type),
  ],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
