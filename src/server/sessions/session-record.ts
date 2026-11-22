import { z } from "zod";
import { type SessionSummary, SessionSummarySchema } from "../../shared/session.ts";

export const SessionRecordSchema = SessionSummarySchema.extend({
  backendSessionId: z.string().nullable(),
});
export type SessionRecord = z.infer<typeof SessionRecordSchema>;

export type SessionChanges = Partial<Omit<SessionRecord, "id" | "createdAt">>;

export function toSummary(record: SessionRecord): SessionSummary {
  const { backendSessionId: _hiddenFromClients, ...summary } = record;
  return summary;
}

export const defaultSessionTitle = "New session";
const maximumTitleLength = 60;

export function titleFromFirstMessage(text: string): string {
  const firstLine = text.trim().split("\n")[0] ?? "";
  return firstLine.length > maximumTitleLength
    ? `${firstLine.slice(0, maximumTitleLength - 1)}…`
    : firstLine;
}
