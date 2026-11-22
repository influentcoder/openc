import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BackendAdapter } from "./backends/backend-adapter.ts";
import { BackendRegistry } from "./backends/backend-registry.ts";
import { FakeBackendAdapter } from "./backends/fake/fake-backend-adapter.ts";
import type { ServerConfig } from "./config.ts";
import { type AppDatabase, openDatabase } from "./db/open-database.ts";
import { type Clock, delay, systemClock } from "./platform/clock.ts";
import { type IdGenerator, randomIdGenerator } from "./platform/id-generator.ts";
import { createLogger, type Logger } from "./platform/logger.ts";
import { EventLog } from "./sessions/event-log.ts";
import { LiveProcesses, type LiveProcessLimits } from "./sessions/live-processes.ts";
import { SessionManager } from "./sessions/session-manager.ts";
import { SessionNotifications } from "./sessions/session-notifications.ts";
import { SessionRecorder } from "./sessions/session-recorder.ts";
import { SessionRepository } from "./sessions/session-repository.ts";
import { SessionViewers } from "./sessions/session-viewers.ts";
import { NewSessionDefaultsService } from "./settings/new-session-defaults.ts";
import { SettingsRepository } from "./settings/settings-repository.ts";
import { DirectoryBrowser } from "./workspace/directory-browser.ts";
import { ScratchDirectories } from "./workspace/scratch-directories.ts";

export interface ExternalDependencies {
  database: AppDatabase;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  backends: BackendAdapter[];
  dataDirectory: string;
  browseRoot: string;
  limits: LiveProcessLimits;
}

export interface Services {
  sessions: SessionManager;
  backends: BackendRegistry;
  directoryBrowser: DirectoryBrowser;
  newSessionDefaults: NewSessionDefaultsService;
  notifications: SessionNotifications;
  viewers: SessionViewers;
  logger: Logger;
  close(): Promise<void>;
}

export const defaultLimits: LiveProcessLimits = {
  maximumLiveProcesses: 6,
  idleReleaseMilliseconds: 10 * 60 * 1000,
};

const fakeStreamingDelayMilliseconds = 30;

export function createServices(dependencies: ExternalDependencies): Services {
  const { database, clock, ids, logger } = dependencies;
  const repository = new SessionRepository(database);
  const eventLog = new EventLog(database, clock);
  const notifications = new SessionNotifications();
  const viewers = new SessionViewers();
  const recorder = new SessionRecorder(repository, eventLog, notifications, clock);
  const backends = new BackendRegistry(dependencies.backends);
  const directoryBrowser = new DirectoryBrowser(dependencies.browseRoot);
  const newSessionDefaults = new NewSessionDefaultsService(
    new SettingsRepository(database),
    repository,
    dependencies.browseRoot,
  );
  const processes = new LiveProcesses({
    backends,
    recorder,
    viewers,
    clock,
    logger,
    limits: dependencies.limits,
  });
  const sessions = new SessionManager({
    repository,
    eventLog,
    recorder,
    notifications,
    processes,
    backends,
    scratchDirectories: new ScratchDirectories(join(dependencies.dataDirectory, "scratch")),
    directoryBrowser,
    newSessionDefaults,
    ids,
    clock,
  });
  sessions.recoverAfterRestart();
  const close = async () => {
    await sessions.shutdown();
    database.close();
  };
  return {
    sessions,
    backends,
    directoryBrowser,
    newSessionDefaults,
    notifications,
    viewers,
    logger,
    close,
  };
}

export async function createExternalDependencies(
  config: ServerConfig,
): Promise<ExternalDependencies> {
  await mkdir(config.dataDirectory, { recursive: true });
  const clock = systemClock;
  const ids = randomIdGenerator;
  return {
    database: openDatabase(join(config.dataDirectory, "openc.db")),
    clock,
    ids,
    logger: createLogger(config.logLevel),
    backends: config.mode === "fake" ? [createFakeBackend(clock, ids)] : [],
    dataDirectory: config.dataDirectory,
    browseRoot: config.browseRoot,
    limits: defaultLimits,
  };
}

function createFakeBackend(clock: Clock, ids: IdGenerator): BackendAdapter {
  return new FakeBackendAdapter({ ids, pace: () => delay(clock, fakeStreamingDelayMilliseconds) });
}
