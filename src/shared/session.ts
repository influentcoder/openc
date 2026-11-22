import { z } from "zod";
import { BackendIdSchema, SessionIdSchema } from "./ids.ts";

export const SessionStatusSchema = z.enum(["idle", "starting", "running", "error"]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const ProcessStateSchema = z.enum(["live", "released"]);
export type ProcessState = z.infer<typeof ProcessStateSchema>;

export const WorkspaceModeSchema = z.enum(["scratch", "directory"]);
export type WorkspaceMode = z.infer<typeof WorkspaceModeSchema>;

export const WorkspaceRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("scratch") }),
  z.object({ mode: z.literal("directory"), path: z.string().min(1) }),
]);
export type WorkspaceRequest = z.infer<typeof WorkspaceRequestSchema>;

export const SessionSummarySchema = z.object({
  id: SessionIdSchema,
  title: z.string(),
  backendId: BackendIdSchema,
  model: z.string(),
  workspaceMode: WorkspaceModeSchema,
  workingDirectory: z.string(),
  status: SessionStatusSchema,
  processState: ProcessStateSchema,
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
