import type { DirectoryListing } from "../../shared/api.ts";
import { BackendIdSchema, type SessionId, SessionIdSchema } from "../../shared/ids.ts";
import type { SessionSummary } from "../../shared/session.ts";
import type { ApiClient } from "../api/api-client.ts";

export const fakeBackend = BackendIdSchema.parse("fake");

export function sessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: SessionIdSchema.parse("session-1"),
    title: "Fix the login bug",
    backendId: fakeBackend,
    model: "fake-fast",
    workspaceMode: "directory",
    workingDirectory: "/home/user/projects/webapp",
    status: "idle",
    processState: "released",
    errorMessage: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export class FakeApiClient implements ApiClient {
  sessions: SessionSummary[] = [];
  readonly sentMessages: { sessionId: SessionId; text: string }[] = [];
  readonly directories = new Map<string | null, DirectoryListing>();

  async listSessions() {
    return this.sessions;
  }

  async createSession() {
    const session = sessionSummary({
      id: SessionIdSchema.parse(`session-${this.sessions.length + 1}`),
    });
    this.sessions = [session, ...this.sessions];
    return session;
  }

  async renameSession(sessionId: SessionId, title: string) {
    return sessionSummary({ id: sessionId, title });
  }

  async deleteSession(sessionId: SessionId) {
    this.sessions = this.sessions.filter((session) => session.id !== sessionId);
  }

  async sendMessage(sessionId: SessionId, text: string) {
    this.sentMessages.push({ sessionId, text });
  }

  async interrupt() {}

  async listBackends() {
    return [
      {
        id: fakeBackend,
        displayName: "Fake backend",
        available: true,
        statusDetail: "",
        models: [{ id: "fake-fast", displayName: "Fake Fast" }],
      },
    ];
  }

  async newSessionDefaults() {
    return {
      backendId: null,
      model: null,
      workspaceMode: "scratch" as const,
      recentDirectories: [],
      browseRoot: "/home/user",
    };
  }

  async listDirectory(path: string | null) {
    const listing = this.directories.get(path);
    if (!listing) {
      throw new Error(`No fake listing for ${path}`);
    }
    return listing;
  }
}
