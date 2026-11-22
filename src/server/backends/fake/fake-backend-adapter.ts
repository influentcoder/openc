import type { ModelInfo } from "../../../shared/api.ts";
import { type BackendId, BackendIdSchema } from "../../../shared/ids.ts";
import type { IdGenerator } from "../../platform/id-generator.ts";
import {
  type BackendAdapter,
  type BackendSession,
  BackendSessionNotFoundError,
  type BackendStatus,
  type ResumeOptions,
  type StartOptions,
} from "../backend-adapter.ts";
import { FakeBackendSession, type Pace } from "./fake-backend-session.ts";
import { type FakeTranscript, FakeTranscriptStore } from "./fake-transcript-store.ts";

export const fakeBackendId: BackendId = BackendIdSchema.parse("fake");

export const fakeModels: ModelInfo[] = [
  { id: "fake-fast", displayName: "Fake Fast" },
  { id: "fake-thorough", displayName: "Fake Thorough" },
];

export interface FakeBackendOptions {
  ids: IdGenerator;
  pace: Pace;
  transcripts?: FakeTranscriptStore;
}

export class FakeBackendAdapter implements BackendAdapter {
  readonly id = fakeBackendId;
  readonly displayName = "Fake backend";
  readonly transcripts: FakeTranscriptStore;
  readonly startedSessions: FakeBackendSession[] = [];
  private readonly options: FakeBackendOptions;

  constructor(options: FakeBackendOptions) {
    this.options = options;
    this.transcripts = options.transcripts ?? new FakeTranscriptStore();
  }

  async status(): Promise<BackendStatus> {
    return { available: true, detail: "Scripted backend for development and tests" };
  }

  async listModels(): Promise<ModelInfo[]> {
    return fakeModels;
  }

  async start(options: StartOptions): Promise<BackendSession> {
    const backendSessionId = `fake-session-${this.options.ids.next()}`;
    const transcript = this.transcripts.create(
      backendSessionId,
      options.workingDirectory,
      options.model,
    );
    return this.track(this.createSession(backendSessionId, transcript));
  }

  async resume(options: ResumeOptions): Promise<BackendSession> {
    const transcript = this.transcripts.find(options.backendSessionId);
    if (!transcript) {
      throw new BackendSessionNotFoundError(options.backendSessionId);
    }
    return this.track(this.createSession(options.backendSessionId, transcript));
  }

  private createSession(backendSessionId: string, transcript: FakeTranscript): FakeBackendSession {
    return new FakeBackendSession(
      backendSessionId,
      transcript,
      this.options.ids,
      this.options.pace,
    );
  }

  private track(session: FakeBackendSession): FakeBackendSession {
    this.startedSessions.push(session);
    return session;
  }
}
