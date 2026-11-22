import { z } from "zod";
import {
  ApiErrorSchema,
  type BackendInfo,
  BackendInfoSchema,
  type CreateSessionRequest,
  type DirectoryListing,
  DirectoryListingSchema,
  type NewSessionDefaults,
  NewSessionDefaultsSchema,
} from "../../shared/api.ts";
import type { SessionId } from "../../shared/ids.ts";
import { type SessionSummary, SessionSummarySchema } from "../../shared/session.ts";

export interface ApiClient {
  listSessions(): Promise<SessionSummary[]>;
  createSession(request: CreateSessionRequest): Promise<SessionSummary>;
  renameSession(sessionId: SessionId, title: string): Promise<SessionSummary>;
  deleteSession(sessionId: SessionId): Promise<void>;
  sendMessage(sessionId: SessionId, text: string): Promise<void>;
  interrupt(sessionId: SessionId): Promise<void>;
  listBackends(): Promise<BackendInfo[]>;
  newSessionDefaults(): Promise<NewSessionDefaults>;
  listDirectory(path: string | null): Promise<DirectoryListing>;
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const anyBody = z.unknown();

export function createHttpApiClient(token: string, fetchFunction: typeof fetch): ApiClient {
  async function request<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    init: RequestInit = {},
  ): Promise<z.infer<Schema>> {
    const response = await fetchFunction(path, {
      ...init,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const body = await readJsonBody(response);
    if (!response.ok) {
      const parsedError = ApiErrorSchema.safeParse(body);
      const message = parsedError.success
        ? parsedError.data.error
        : `Request failed with status ${response.status}`;
      throw new ApiRequestError(response.status, message);
    }
    return schema.parse(body);
  }
  const sessionPath = (sessionId: SessionId) => `/api/sessions/${encodeURIComponent(sessionId)}`;
  return {
    listSessions: () => request("/api/sessions", z.array(SessionSummarySchema)),
    createSession: (body) =>
      request("/api/sessions", SessionSummarySchema, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    renameSession: (sessionId, title) =>
      request(sessionPath(sessionId), SessionSummarySchema, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    deleteSession: async (sessionId) => {
      await request(sessionPath(sessionId), anyBody, { method: "DELETE" });
    },
    sendMessage: async (sessionId, text) => {
      await request(`${sessionPath(sessionId)}/messages`, anyBody, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    },
    interrupt: async (sessionId) => {
      await request(`${sessionPath(sessionId)}/interrupt`, anyBody, { method: "POST" });
    },
    listBackends: () => request("/api/backends", z.array(BackendInfoSchema)),
    newSessionDefaults: () => request("/api/new-session-defaults", NewSessionDefaultsSchema),
    listDirectory: (path) =>
      request(
        path === null ? "/api/directories" : `/api/directories?path=${encodeURIComponent(path)}`,
        DirectoryListingSchema,
      ),
  };
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
