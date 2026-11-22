import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { SessionSummarySchema } from "../../shared/session.ts";
import { settleUntil } from "../testing/fake-clock.ts";
import { testServerFactory } from "../testing/running-test-server.ts";

const startTestServer = testServerFactory();

async function createSessionThroughApi(
  api: (path: string, init?: RequestInit) => Promise<Response>,
) {
  const response = await api("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ backendId: "fake", model: "fake-fast", workspace: { mode: "scratch" } }),
  });
  return SessionSummarySchema.parse(await response.json());
}

describe("R-PLAT-4 live updates", () => {
  it("streams deltas and persisted events of subscribed sessions", async () => {
    const { api, connectLive } = await startTestServer();
    const session = await createSessionThroughApi(api);
    const live = await connectLive();
    live.send({ type: "subscribe", sessionId: session.id, sinceSeq: 0 });
    await api(`/api/sessions/${session.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text: "hello world" }),
    });
    await live.waitFor(
      (message) =>
        message.type === "session.event" && message.envelope.event.type === "turn.completed",
    );
    expect(live.messages.some((message) => message.type === "session.delta")).toBe(true);
    live.close();
  });

  it("replays the backlog after the given sequence number when a client reconnects", async () => {
    const { api, connectLive, harness } = await startTestServer();
    const session = await createSessionThroughApi(api);
    await harness.sendAndWait(session.id, "before reconnect");
    const live = await connectLive();
    live.send({ type: "subscribe", sessionId: session.id, sinceSeq: 2 });
    await live.waitFor(
      (message) =>
        message.type === "session.event" && message.envelope.event.type === "turn.completed",
    );
    const replayedSeqs = live.messages.flatMap((message) =>
      message.type === "session.event" ? [message.envelope.seq] : [],
    );
    expect(replayedSeqs).toEqual([3, 4, 5]);
    live.close();
  });

  it("R-SES-15 counts subscribed clients as viewers", async () => {
    const { api, connectLive, harness } = await startTestServer();
    const session = await createSessionThroughApi(api);
    const live = await connectLive();
    live.send({ type: "subscribe", sessionId: session.id, sinceSeq: 0 });
    await settleUntil(() => harness.services.viewers.isViewed(session.id), 20000);
    live.close();
    await settleUntil(() => !harness.services.viewers.isViewed(session.id), 20000);
  });

  it("broadcasts session updates to every client", async () => {
    const { api, connectLive } = await startTestServer();
    const live = await connectLive();
    const session = await createSessionThroughApi(api);
    await live.waitFor(
      (message) => message.type === "session.updated" && message.session.id === session.id,
    );
    live.close();
  });

  it("refuses connections without the token", async () => {
    const { server } = await startTestServer();
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws?token=wrong`);
    const statusCode = await new Promise<number | undefined>((resolve) => {
      socket.once("unexpected-response", (_request, response) => resolve(response.statusCode));
    });
    expect(statusCode).toBe(401);
  });
});
