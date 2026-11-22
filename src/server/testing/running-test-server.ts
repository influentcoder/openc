import { afterEach } from "vitest";
import { WebSocket } from "ws";
import { type ServerMessage, ServerMessageSchema } from "../../shared/live-protocol.ts";
import { type RunningServer, startServer } from "../server.ts";
import { settleUntil } from "./fake-clock.ts";
import { createSessionTestHarness, type SessionTestHarness } from "./session-test-harness.ts";

export const testToken = "test-token";

export interface RunningTestServer {
  harness: SessionTestHarness;
  server: RunningServer;
  api(path: string, init?: RequestInit): Promise<Response>;
  connectLive(): Promise<LiveTestClient>;
}

export interface LiveTestClient {
  messages: ServerMessage[];
  send(message: unknown): void;
  waitFor(predicate: (message: ServerMessage) => boolean): Promise<ServerMessage>;
  close(): void;
}

export function testServerFactory(): () => Promise<RunningTestServer> {
  const servers: RunningServer[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });
  return async () => {
    const harness = await createSessionTestHarness();
    const server = await startServer(harness.services, {
      host: "127.0.0.1",
      port: 0,
      token: testToken,
      webDistDirectory: harness.dataDirectory,
    });
    servers.push(server);
    return {
      harness,
      server,
      api: (path, init = {}) =>
        fetch(`${server.url}${path}`, {
          ...init,
          headers: {
            authorization: `Bearer ${testToken}`,
            "content-type": "application/json",
            ...init.headers,
          },
        }),
      connectLive: () => connectLiveClient(`ws://127.0.0.1:${server.port}/ws?token=${testToken}`),
    };
  };
}

async function connectLiveClient(url: string): Promise<LiveTestClient> {
  const socket = new WebSocket(url);
  const messages: ServerMessage[] = [];
  socket.on("message", (data) =>
    messages.push(ServerMessageSchema.parse(JSON.parse(String(data)))),
  );
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  return {
    messages,
    send: (message) => socket.send(JSON.stringify(message)),
    async waitFor(predicate) {
      await settleUntil(() => messages.some(predicate), 20000);
      const match = messages.find(predicate);
      if (!match) {
        throw new Error("No matching live message");
      }
      return match;
    },
    close: () => socket.close(),
  };
}
