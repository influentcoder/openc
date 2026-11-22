import { z } from "zod";
import { BackendIdSchema } from "./ids.ts";
import { WorkspaceModeSchema, WorkspaceRequestSchema } from "./session.ts";

export const ModelInfoSchema = z.object({ id: z.string(), displayName: z.string() });
export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export const BackendInfoSchema = z.object({
  id: BackendIdSchema,
  displayName: z.string(),
  available: z.boolean(),
  statusDetail: z.string(),
  models: z.array(ModelInfoSchema),
});
export type BackendInfo = z.infer<typeof BackendInfoSchema>;

export const CreateSessionRequestSchema = z.object({
  backendId: BackendIdSchema,
  model: z.string().min(1),
  workspace: WorkspaceRequestSchema,
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const SendMessageRequestSchema = z.object({ text: z.string().trim().min(1) });
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const RenameSessionRequestSchema = z.object({ title: z.string().trim().min(1).max(200) });
export type RenameSessionRequest = z.infer<typeof RenameSessionRequestSchema>;

export const DirectoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isGitRepository: z.boolean(),
});
export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;

export const DirectoryListingSchema = z.object({
  path: z.string(),
  parentPath: z.string().nullable(),
  entries: z.array(DirectoryEntrySchema),
});
export type DirectoryListing = z.infer<typeof DirectoryListingSchema>;

export const NewSessionDefaultsSchema = z.object({
  backendId: BackendIdSchema.nullable(),
  model: z.string().nullable(),
  workspaceMode: WorkspaceModeSchema,
  recentDirectories: z.array(z.string()),
  browseRoot: z.string(),
});
export type NewSessionDefaults = z.infer<typeof NewSessionDefaultsSchema>;

export const ApiErrorSchema = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;
