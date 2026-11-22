import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionId } from "../../shared/ids.ts";
import type { SessionStatus } from "../../shared/session.ts";
import { FakeBackendAdapter, fakeBackendId } from "../backends/fake/fake-backend-adapter.ts";
import type { Pace } from "../backends/fake/fake-backend-session.ts";
import { createServices, defaultLimits, type Services } from "../composition.ts";
import { inMemoryDatabasePath, openDatabase } from "../db/open-database.ts";
import { createLogger } from "../platform/logger.ts";
import type { LiveProcessLimits } from "../sessions/live-processes.ts";
import { FakeClock, settleUntil } from "./fake-clock.ts";
import { sequentialIds } from "./sequential-ids.ts";

export interface SessionTestHarness {
  services: Services;
  clock: FakeClock;
  fakeBackend: FakeBackendAdapter;
  dataDirectory: string;
  browseRoot: string;
  createScratchSession(): Promise<SessionId>;
  waitForStatus(sessionId: SessionId, status: SessionStatus): Promise<void>;
  sendAndWait(sessionId: SessionId, text: string): Promise<void>;
}

export interface SessionTestHarnessOptions {
  limits?: Partial<LiveProcessLimits>;
  pace?: Pace;
}

export const immediatePace: Pace = () => new Promise((resolve) => setImmediate(resolve));

export async function createSessionTestHarness(
  options: SessionTestHarnessOptions = {},
): Promise<SessionTestHarness> {
  const root = await mkdtemp(join(tmpdir(), "openc-harness-"));
  const clock = new FakeClock();
  const fakeBackend = new FakeBackendAdapter({
    ids: sequentialIds("backend"),
    pace: options.pace ?? immediatePace,
  });
  const services = createServices({
    database: openDatabase(inMemoryDatabasePath),
    clock,
    ids: sequentialIds("openc"),
    logger: createLogger("silent"),
    backends: [fakeBackend],
    dataDirectory: join(root, "data"),
    browseRoot: root,
    limits: { ...defaultLimits, ...options.limits },
  });
  const waitForStatus = (sessionId: SessionId, status: SessionStatus) =>
    settleUntil(() => services.sessions.get(sessionId).status === status);
  return {
    services,
    clock,
    fakeBackend,
    dataDirectory: join(root, "data"),
    browseRoot: root,
    waitForStatus,
    async createScratchSession() {
      const workspace = { mode: "scratch" } as const;
      const request = { backendId: fakeBackendId, model: "fake-fast", workspace };
      return (await services.sessions.create(request)).id;
    },
    async sendAndWait(sessionId, text) {
      await services.sessions.sendMessage(sessionId, text);
      await settleUntil(
        () => !["starting", "running"].includes(services.sessions.get(sessionId).status),
      );
    },
  };
}
