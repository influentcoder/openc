import { describe, expect, it } from "vitest";
import { createSessionTestHarness } from "../testing/session-test-harness.ts";
import { contextLostReason } from "./backend-session-opener.ts";
import { interruptedByRestartMessage } from "./session-manager.ts";

const tenMinutes = 10 * 60 * 1000;

describe("R-SES-15 releasing idle processes", () => {
  it("releases the process after ten idle minutes", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.sendAndWait(sessionId, "hello");
    await harness.clock.advanceBy(tenMinutes - 1);
    expect(harness.services.sessions.get(sessionId).processState).toBe("live");
    await harness.clock.advanceBy(1);
    expect(harness.services.sessions.get(sessionId).processState).toBe("released");
  });

  it("keeps the process while the session is open on screen", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    harness.services.viewers.add(sessionId);
    await harness.sendAndWait(sessionId, "hello");
    await harness.clock.advanceBy(tenMinutes * 3);
    expect(harness.services.sessions.get(sessionId).processState).toBe("live");
    harness.services.viewers.remove(sessionId);
    await harness.clock.advanceBy(tenMinutes);
    expect(harness.services.sessions.get(sessionId).processState).toBe("released");
  });
});

describe("R-SES-9 live process limit", () => {
  it("releases the least recently used idle process to make room", async () => {
    const harness = await createSessionTestHarness({ limits: { maximumLiveProcesses: 2 } });
    const first = await harness.createScratchSession();
    const second = await harness.createScratchSession();
    const third = await harness.createScratchSession();
    await harness.sendAndWait(first, "one");
    await harness.sendAndWait(second, "two");
    await harness.sendAndWait(first, "one again");
    await harness.sendAndWait(third, "three");
    const states = [first, second, third].map(
      (sessionId) => harness.services.sessions.get(sessionId).processState,
    );
    expect(states).toEqual(["live", "released", "live"]);
  });
});

describe("R-SES-16 respawning a released session", () => {
  it("resumes the same backend conversation on the next message", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.sendAndWait(sessionId, "first");
    await harness.clock.advanceBy(tenMinutes);
    await harness.sendAndWait(sessionId, "second");
    const events = harness.services.sessions.eventsSince(sessionId, 0).map((e) => e.event);
    expect(events.filter((event) => event.type === "backend.started")).toMatchObject([
      { resumed: false },
      { resumed: true },
    ]);
    expect(events.filter((event) => event.type === "assistant.message").at(-1)).toMatchObject({
      text: "Echo #2: second",
    });
  });

  it("R-SES-17 starts a fresh backend session when the backend lost the conversation", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.sendAndWait(sessionId, "first");
    await harness.clock.advanceBy(tenMinutes);
    const lostConversation = harness.fakeBackend.startedSessions[0]?.backendSessionId ?? "";
    harness.fakeBackend.transcripts.forget(lostConversation);
    await harness.sendAndWait(sessionId, "second");
    const events = harness.services.sessions.eventsSince(sessionId, 0).map((e) => e.event);
    expect(events).toContainEqual({ type: "context.rebuilt", reason: contextLostReason });
    expect(harness.services.sessions.get(sessionId).status).toBe("idle");
  });
});

describe("restart recovery", () => {
  it("marks sessions that were running as interrupted by the restart", async () => {
    const harness = await createSessionTestHarness();
    const sessionId = await harness.createScratchSession();
    await harness.services.sessions.sendMessage(sessionId, "be slow");
    harness.services.sessions.recoverAfterRestart();
    expect(harness.services.sessions.get(sessionId)).toMatchObject({
      status: "error",
      errorMessage: interruptedByRestartMessage,
      processState: "released",
    });
    const lastEvent = harness.services.sessions.eventsSince(sessionId, 0).at(-1)?.event;
    expect(lastEvent).toMatchObject({ type: "turn.completed", reason: "error" });
  });
});
