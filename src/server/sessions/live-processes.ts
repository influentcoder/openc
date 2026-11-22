import type { SessionId, TurnId } from "../../shared/ids.ts";
import type { BackendEvent, BackendSession } from "../backends/backend-adapter.ts";
import type { BackendRegistry } from "../backends/backend-registry.ts";
import type { Clock, TimerHandle } from "../platform/clock.ts";
import type { Logger } from "../platform/logger.ts";
import { toHarnessEvent } from "./backend-event-translation.ts";
import { openBackendSession } from "./backend-session-opener.ts";
import { errorMessageOf, LiveProcessLimitError } from "./session-errors.ts";
import type { SessionRecord } from "./session-record.ts";
import type { SessionRecorder } from "./session-recorder.ts";
import type { SessionViewers } from "./session-viewers.ts";

export interface LiveProcessLimits {
  maximumLiveProcesses: number;
  idleReleaseMilliseconds: number;
}

export interface LiveProcess {
  readonly sessionId: SessionId;
  readonly backendSession: BackendSession;
  activeTurnId: TurnId | null;
  idleTimer: TimerHandle | null;
}

export interface LiveProcessDependencies {
  backends: BackendRegistry;
  recorder: SessionRecorder;
  viewers: SessionViewers;
  clock: Clock;
  logger: Logger;
  limits: LiveProcessLimits;
}

export const unexpectedExitMessage = "The agent process stopped unexpectedly";

export class LiveProcesses {
  private readonly dependencies: LiveProcessDependencies;
  private readonly processes = new Map<SessionId, LiveProcess>();

  constructor(dependencies: LiveProcessDependencies) {
    this.dependencies = dependencies;
  }

  get liveSessionIds(): SessionId[] {
    return [...this.processes.keys()];
  }

  async ensure(record: SessionRecord): Promise<LiveProcess> {
    const existing = this.processes.get(record.id);
    if (existing) {
      this.markRecentlyUsed(existing);
      return existing;
    }
    await this.makeRoom();
    const { backends, recorder } = this.dependencies;
    const backendSession = await openBackendSession(record, backends, recorder);
    const process: LiveProcess = {
      sessionId: record.id,
      backendSession,
      activeTurnId: null,
      idleTimer: null,
    };
    this.processes.set(record.id, process);
    recorder.update(record.id, {
      processState: "live",
      backendSessionId: backendSession.backendSessionId,
    });
    void this.pumpEvents(process);
    return process;
  }

  beginTurn(process: LiveProcess, turnId: TurnId): void {
    process.idleTimer?.cancel();
    process.idleTimer = null;
    process.activeTurnId = turnId;
  }

  async interrupt(sessionId: SessionId): Promise<void> {
    const process = this.processes.get(sessionId);
    if (process?.activeTurnId) {
      await process.backendSession.interrupt();
    }
  }

  async release(sessionId: SessionId): Promise<void> {
    const process = this.processes.get(sessionId);
    if (!process) {
      return;
    }
    this.processes.delete(sessionId);
    process.idleTimer?.cancel();
    await process.backendSession.close();
    this.dependencies.recorder.update(sessionId, { processState: "released" });
    this.dependencies.logger.info({ sessionId }, "Released agent process");
  }

  async releaseAll(): Promise<void> {
    await Promise.all(this.liveSessionIds.map((sessionId) => this.release(sessionId)));
  }

  private markRecentlyUsed(process: LiveProcess): void {
    this.processes.delete(process.sessionId);
    this.processes.set(process.sessionId, process);
  }

  private async makeRoom(): Promise<void> {
    const { maximumLiveProcesses } = this.dependencies.limits;
    if (this.processes.size < maximumLiveProcesses) {
      return;
    }
    const idleProcesses = [...this.processes.values()].filter(
      (process) => process.activeTurnId === null,
    );
    const candidate =
      idleProcesses.find((process) => !this.dependencies.viewers.isViewed(process.sessionId)) ??
      idleProcesses[0];
    if (!candidate) {
      throw new LiveProcessLimitError(maximumLiveProcesses);
    }
    await this.release(candidate.sessionId);
  }

  private scheduleIdleRelease(process: LiveProcess): void {
    process.idleTimer?.cancel();
    process.idleTimer = this.dependencies.clock.setTimeout(
      () => void this.releaseIfStillIdle(process),
      this.dependencies.limits.idleReleaseMilliseconds,
    );
  }

  private async releaseIfStillIdle(process: LiveProcess): Promise<void> {
    if (this.processes.get(process.sessionId) !== process || process.activeTurnId !== null) {
      return;
    }
    if (this.dependencies.viewers.isViewed(process.sessionId)) {
      this.scheduleIdleRelease(process);
      return;
    }
    await this.release(process.sessionId);
  }

  private async pumpEvents(process: LiveProcess): Promise<void> {
    try {
      for await (const event of process.backendSession.events) {
        this.handleEvent(process, event);
      }
      this.handleUnexpectedEnd(process, unexpectedExitMessage);
    } catch (error) {
      this.dependencies.logger.error(
        { sessionId: process.sessionId, error },
        "Agent stream failed",
      );
      this.handleUnexpectedEnd(process, `${unexpectedExitMessage}: ${errorMessageOf(error)}`);
    }
  }

  private handleEvent(process: LiveProcess, event: BackendEvent): void {
    const { recorder, logger } = this.dependencies;
    const { sessionId, activeTurnId: turnId } = process;
    if (turnId === null) {
      logger.warn({ sessionId, eventType: event.type }, "Ignoring backend event outside a turn");
      return;
    }
    if (event.type === "assistant.delta") {
      recorder.publishDelta({ sessionId, turnId, messageId: event.messageId, text: event.text });
      return;
    }
    recorder.append(sessionId, toHarnessEvent(event, turnId));
    if (event.type === "turn.completed") {
      process.activeTurnId = null;
      recorder.recordActivity(sessionId, {
        status: event.reason === "error" ? "error" : "idle",
        errorMessage: event.errorMessage,
      });
      this.scheduleIdleRelease(process);
    }
  }

  private handleUnexpectedEnd(process: LiveProcess, errorMessage: string): void {
    if (this.processes.get(process.sessionId) !== process) {
      return;
    }
    this.processes.delete(process.sessionId);
    process.idleTimer?.cancel();
    const { recorder } = this.dependencies;
    if (process.activeTurnId) {
      recorder.append(process.sessionId, {
        type: "turn.completed",
        turnId: process.activeTurnId,
        reason: "error",
        errorMessage,
      });
    }
    recorder.update(process.sessionId, { status: "error", errorMessage, processState: "released" });
  }
}
