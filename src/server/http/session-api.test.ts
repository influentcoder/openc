import { request as httpRequest } from "node:http";
import { describe, expect, it } from "vitest";
import { SessionSummarySchema } from "../../shared/session.ts";
import { testServerFactory } from "../testing/running-test-server.ts";

const startTestServer = testServerFactory();
const scratchSessionRequest = JSON.stringify({
  backendId: "fake",
  model: "fake-fast",
  workspace: { mode: "scratch" },
});

describe("R-PLAT-3 access control", () => {
  it("rejects API calls without the access token", async () => {
    const { server } = await startTestServer();
    expect((await fetch(`${server.url}/api/sessions`)).status).toBe(401);
  });

  it("rejects requests whose Host is not a loopback address", async () => {
    const { server } = await startTestServer();
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const request = httpRequest(
        {
          host: "127.0.0.1",
          port: server.port,
          path: "/health",
          headers: { host: "evil.example" },
        },
        (response) => resolve(response.statusCode),
      );
      request.once("error", reject);
      request.end();
    });
    expect(status).toBe(403);
  });

  it("answers the health check without a token", async () => {
    const { server } = await startTestServer();
    expect((await fetch(`${server.url}/health`)).status).toBe(200);
  });
});

describe("session API", () => {
  it("creates, lists, renames and deletes sessions", async () => {
    const { api } = await startTestServer();
    const created = await api("/api/sessions", { method: "POST", body: scratchSessionRequest });
    expect(created.status).toBe(201);
    const session = SessionSummarySchema.parse(await created.json());
    const renamed = await api(`/api/sessions/${session.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title: "Renamed" }),
    });
    expect(await renamed.json()).toMatchObject({ title: "Renamed" });
    expect(await (await api("/api/sessions")).json()).toHaveLength(1);
    expect((await api(`/api/sessions/${session.id}`, { method: "DELETE" })).status).toBe(204);
    expect((await api(`/api/sessions/${session.id}`)).status).toBe(404);
  });

  it("explains invalid requests with a 400", async () => {
    const { api } = await startTestServer();
    const response = await api("/api/sessions", { method: "POST", body: "{}" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Invalid") });
  });

  it("answers 409 when a message is sent while the session is busy", async () => {
    const { api } = await startTestServer();
    const session = SessionSummarySchema.parse(
      await (await api("/api/sessions", { method: "POST", body: scratchSessionRequest })).json(),
    );
    const send = (text: string) =>
      api(`/api/sessions/${session.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
    expect((await send("be slow")).status).toBe(202);
    expect((await send("again")).status).toBe(409);
  });

  it("lists backends with their models and the new-session defaults", async () => {
    const { api, harness } = await startTestServer();
    expect(await (await api("/api/backends")).json()).toMatchObject([
      { id: "fake", available: true, models: [{ id: "fake-fast" }, { id: "fake-thorough" }] },
    ]);
    expect(await (await api("/api/new-session-defaults")).json()).toMatchObject({
      backendId: null,
      workspaceMode: "scratch",
      browseRoot: harness.browseRoot,
    });
  });
});
