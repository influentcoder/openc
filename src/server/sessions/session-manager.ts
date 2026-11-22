import type { CreateSessionRequest } from "../../shared/api.ts";
import type { EventEnvelope } from "../../shared/events.ts";
import { type SessionId, SessionIdSchema, type TurnId, TurnIdSchema } from "../../shared/ids.ts";
import type { SessionSummary } from "../../shared/session.ts";
import type { BackendRegistry } from "../backends/backend-registry.ts";
import type { Clock } from "../platform/clock.ts";
import type { IdGenerator } from "../platform/id-generator.ts";
import type { NewSessionDefaultsService } from "../settings/new-session-defaults.ts";
import type { DirectoryBrowser } from "../workspace/directory-browser.ts";
import type { ScratchDirectories } from "../workspace/scratch-directories.ts";
import type { EventLog } from "./event-log.ts";
import type { LiveProcesses } from "./live-processes.ts";
import { errorMessageOf, SessionBusyError, UnknownModelError } from "./session-errors.ts";
import type { SessionNotifications } from "./session-notifications.ts";
import {
  defaultSessionTitle,
  type SessionRecord,
  titleFromFirstMessage,
  toSummary,
} from "./session-record.ts";
import type { SessionRecorder } from "./session-recorder.ts";
import type { SessionRepository } from "./session-repository.ts";

export interface SessionManagerDependencies {
  repository: SessionRepository;
  eventLog: EventLog;
  recorder: SessionRecorder;
  notifications: SessionNotifications;
  processes: LiveProcesses;
  backends: BackendRegistry;
  scratchDirectories: ScratchDirectories;
  directoryBrowser: DirectoryBrowser;
  newSessionDefaults: NewSessionDefaultsService;
  ids: IdGenerator;
  clock: Clock;
}

export const interruptedByRestartMessage = "Interrupted because openc restarted";

export class SessionManager {
  private readonly dependencies: SessionManagerDependencies;

  constructor(dependencies: SessionManagerDependencies) {
    this.dependencies = dependencies;
  }

  list(): SessionSummary[] {
    return this.dependencies.repository.listByRecentActivity().map(toSummary);
  }

  get(sessionId: SessionId): SessionSummary {
    return toSummary(this.dependencies.repository.get(sessionId));
  }

  eventsSince(sessionId: SessionId, sinceSeq: number): EventEnvelope[] {
    this.dependencies.repository.get(sessionId);
    return this.dependencies.eventLog.listSince(sessionId, sinceSeq);
  }

  async create(request: CreateSessionRequest): Promise<SessionSummary> {
    const { backends, ids, clock, repository, notifications, newSessionDefaults } =
      this.dependencies;
    const models = await backends.get(request.backendId).listModels();
    if (!models.some((model) => model.id === request.model)) {
      throw new UnknownModelError(request.model);
    }
    const sessionId = SessionIdSchema.parse(ids.next());
    const now = clock.now().toISOString();
    const record: SessionRecord = {
      id: sessionId,
      title: defaultSessionTitle,
      backendId: request.backendId,
      model: request.model,
      workspaceMode: request.workspace.mode,
      workingDirectory: await this.prepareWorkspace(sessionId, request),
      status: "idle",
      processState: "released",
      errorMessage: null,
      backendSessionId: null,
      createdAt: now,
      lastActivityAt: now,
    };
    repository.insert(record);
    newSessionDefaults.remember({
      backendId: request.backendId,
      model: request.model,
      workspaceMode: request.workspace.mode,
    });
    notifications.publish({ type: "session.updated", session: toSummary(record) });
    return toSummary(record);
  }

  rename(sessionId: SessionId, title: string): SessionSummary {
    return toSummary(this.dependencies.recorder.update(sessionId, { title }));
  }

  async delete(sessionId: SessionId): Promise<void> {
    const { repository, processes, eventLog, scratchDirectories, notifications } =
      this.dependencies;
    const record = repository.get(sessionId);
    await processes.release(sessionId);
    repository.delete(sessionId);
    eventLog.forget(sessionId);
    if (record.workspaceMode === "scratch") {
      await scratchDirectories.remove(sessionId);
    }
    notifications.publish({ type: "session.deleted", sessionId });
  }

  async sendMessage(sessionId: SessionId, text: string): Promise<TurnId> {
    const { repository, recorder, processes, ids } = this.dependencies;
    const record = repository.get(sessionId);
    if (record.status === "starting" || record.status === "running") {
      throw new SessionBusyError(sessionId);
    }
    const turnId = TurnIdSchema.parse(ids.next());
    const title = record.title === defaultSessionTitle ? titleFromFirstMessage(text) : record.title;
    const startingRecord = recorder.recordActivity(sessionId, {
      status: "starting",
      title,
      errorMessage: null,
    });
    let turnStarted = false;
    try {
      const process = await processes.ensure(startingRecord);
      recorder.append(sessionId, { type: "turn.started", turnId, text });
      turnStarted = true;
      processes.beginTurn(process, turnId);
      recorder.update(sessionId, { status: "running" });
      await process.backendSession.send(text);
      return turnId;
    } catch (error) {
      this.recordFailedStart(sessionId, turnStarted ? turnId : null, errorMessageOf(error));
      throw error;
    }
  }

  async interrupt(sessionId: SessionId): Promise<void> {
    this.dependencies.repository.get(sessionId);
    await this.dependencies.processes.interrupt(sessionId);
  }

  recoverAfterRestart(): void {
    const { repository, eventLog } = this.dependencies;
    for (const record of repository.listWithStatus(["starting", "running"])) {
      this.recordFailedStart(
        record.id,
        eventLog.findOpenTurn(record.id),
        interruptedByRestartMessage,
      );
    }
    repository.markAllProcessesReleased();
  }

  async shutdown(): Promise<void> {
    await this.dependencies.processes.releaseAll();
  }

  private recordFailedStart(sessionId: SessionId, turnId: TurnId | null, errorMessage: string) {
    const { recorder } = this.dependencies;
    if (turnId) {
      recorder.append(sessionId, { type: "turn.completed", turnId, reason: "error", errorMessage });
    }
    recorder.update(sessionId, { status: "error", errorMessage });
  }

  private async prepareWorkspace(sessionId: SessionId, request: CreateSessionRequest) {
    const { workspace } = request;
    return workspace.mode === "scratch"
      ? this.dependencies.scratchDirectories.create(sessionId)
      : this.dependencies.directoryBrowser.resolveWorkingDirectory(workspace.path);
  }
}
