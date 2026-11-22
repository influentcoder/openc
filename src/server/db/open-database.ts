import { join } from "node:path";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

export type AppDatabase = BetterSQLite3Database & { close(): void };

export const inMemoryDatabasePath = ":memory:";

export function openDatabase(path: string): AppDatabase {
  const connection = new Database(path);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  const database = drizzle({ client: connection });
  migrate(database, { migrationsFolder: join(import.meta.dirname, "migrations") });
  return Object.assign(database, { close: () => connection.close() });
}
