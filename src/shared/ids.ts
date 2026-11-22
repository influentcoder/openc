import { z } from "zod";

export const SessionIdSchema = z.string().min(1).brand<"SessionId">();
export type SessionId = z.infer<typeof SessionIdSchema>;

export const TurnIdSchema = z.string().min(1).brand<"TurnId">();
export type TurnId = z.infer<typeof TurnIdSchema>;

export const BackendIdSchema = z.string().min(1).brand<"BackendId">();
export type BackendId = z.infer<typeof BackendIdSchema>;
