import { eq } from "drizzle-orm";
import type { z } from "zod";
import type { AppDatabase } from "../db/open-database.ts";
import { settings } from "../db/schema.ts";

export class SettingsRepository {
  private readonly database: AppDatabase;

  constructor(database: AppDatabase) {
    this.database = database;
  }

  read<Schema extends z.ZodType>(key: string, schema: Schema): z.infer<Schema> | undefined {
    const row = this.database.select().from(settings).where(eq(settings.key, key)).get();
    return row ? schema.parse(JSON.parse(row.value)) : undefined;
  }

  write(key: string, value: unknown): void {
    const serialized = JSON.stringify(value);
    this.database
      .insert(settings)
      .values({ key, value: serialized })
      .onConflictDoUpdate({ target: settings.key, set: { value: serialized } })
      .run();
  }
}
