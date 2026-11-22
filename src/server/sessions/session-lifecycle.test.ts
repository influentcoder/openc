import { stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeBackendId } from "../backends/fake/fake-backend-adapter.ts";
import { createSessionTestHarness } from "../testing/session-test-harness.ts";
import { PathOutsideRootError } from "../workspace/path-guard.ts";
import { SessionBusyError, UnknownModelError } from "./session-errors.ts";

describe("R-SES-1 creating a session", () => {
  it("creates an idle scratch session in its own directory and remembers the choices", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    const session = harness.services.sessions.get(sessionId);
    expect(session).toMatchObject({
      title: "New session",
      status: "idle",
      processState: "released",
    });
    expect(session.workingDirectory).toBe(join(harness.dataDirectory, "scratch", sessionId));
    expect((await stat(session.workingDirectory)).isDirectory()).toBe(true);
    expect(harness.services.newSessionDefaults.current()).toMatchObject({
      backendId: fakeBackendId,
      model: "fake-fast",
      workspaceMode: "scratch",
    });
  });

  it("works directly in an existing directory under the browse root", async () => {
    const harness = await createSessionTestHarness();
    const session = await harness.services.sessions.create({
      backendId: fakeBackendId,
      model: "fake-thorough",
      workspace: { mode: "directory", path: harness.browseRoot },
    });
    expect(session.workingDirectory).toBe(harness.browseRoot);
    expect(harness.services.newSessionDefaults.current().recentDirectories).toEqual([
      harness.browseRoot,
    ]);
  });

  it("rejects directories outside the browse root and unknown models", async () => {
    const harness = await createSessionTestHarness();
    const create = (path: string, model: string) =>
      harness.services.sessions.create({
        backendId: fakeBackendId,
        model,
        workspace: { mode: "directory", path },
      });
    await expect(create("/", "fake-fast")).rejects.toBeInstanceOf(PathOutsideRootError);
    await expect(create(harness.browseRoot, "nope")).rejects.toBeInstanceOf(UnknownModelError);
  });
});

describe("R-CHAT-1 sending messages", () => {
  it("records the turn, the assistant reply and usage, then returns to idle", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.sendAndWait(sessionId, "hello there");
    const eventTypes = harness.services.sessions
      .eventsSince(sessionId, 0)
      .map((envelope) => envelope.event.type);
    expect(eventTypes).toEqual([
      "backend.started",
      "turn.started",
      "assistant.message",
      "usage",
      "turn.completed",
    ]);
    expect(harness.services.sessions.get(sessionId)).toMatchObject({
      status: "idle",
      processState: "live",
    });
  });

  it("R-SES-8 titles the session from the first message only", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.sendAndWait(sessionId, "Fix the login bug\nmore details");
    await harness.sendAndWait(sessionId, "second message");
    expect(harness.services.sessions.get(sessionId).title).toBe("Fix the login bug");
  });

  it("refuses a second message while a turn is running", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.services.sessions.sendMessage(sessionId, "be slow");
    await expect(harness.services.sessions.sendMessage(sessionId, "again")).rejects.toBeInstanceOf(
      SessionBusyError,
    );
  });

  it("R-CHAT-3 interrupting ends the turn as interrupted", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.services.sessions.sendMessage(sessionId, "be slow");
    await harness.services.sessions.interrupt(sessionId);
    await harness.waitForStatus(sessionId, "idle");
    const lastEvent = harness.services.sessions.eventsSince(sessionId, 0).at(-1)?.event;
    expect(lastEvent).toMatchObject({ type: "turn.completed", reason: "interrupted" });
  });

  it("puts the session in error when the backend fails, and accepts new messages after", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.sendAndWait(sessionId, "please fail");
    expect(harness.services.sessions.get(sessionId)).toMatchObject({
      status: "error",
      errorMessage: "Simulated backend failure",
    });
    await harness.sendAndWait(sessionId, "and now?");
    expect(harness.services.sessions.get(sessionId).status).toBe("idle");
  });
});

describe("R-SES-12 deleting a session", () => {
  it("stops the process, removes the scratch directory and forgets the history", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.sendAndWait(sessionId, "hello");
    const { workingDirectory } = harness.services.sessions.get(sessionId);
    await harness.services.sessions.delete(sessionId);
    await expect(stat(workingDirectory)).rejects.toThrow("ENOENT");
    expect(harness.services.sessions.list()).toEqual([]);
  });

  it("never deletes a directory the user chose", async () => {
    const harness = await createSessionTestHarness();
    const session = await harness.services.sessions.create({
      backendId: fakeBackendId,
      model: "fake-fast",
      workspace: { mode: "directory", path: harness.browseRoot },
    });
    await harness.services.sessions.delete(session.id);
    expect((await stat(harness.browseRoot)).isDirectory()).toBe(true);
  });
});
