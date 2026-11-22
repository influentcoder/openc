import { describe, expect, it } from "vitest";
import {
  type BackendAdapter,
  type BackendEvent,
  type BackendSession,
  BackendSessionNotFoundError,
} from "./backend-adapter.ts";

export interface BackendContractHarness {
  adapter: BackendAdapter;
  workingDirectory: string;
  model: string;
  shortPrompt: string;
  longRunningPrompt: string;
}

export async function collectTurn(session: BackendSession): Promise<BackendEvent[]> {
  const events: BackendEvent[] = [];
  for await (const event of session.events) {
    events.push(event);
    if (event.type === "turn.completed") {
      return events;
    }
  }
  throw new Error("Event stream ended before the turn completed");
}

export function describeBackendAdapterContract(
  name: string,
  createHarness: () => Promise<BackendContractHarness>,
): void {
  describe(`${name} satisfies the backend adapter contract`, () => {
    it("reports its status and at least one model", async () => {
      const { adapter } = await createHarness();
      expect((await adapter.status()).available).toBe(true);
      expect((await adapter.listModels()).length).toBeGreaterThan(0);
    });

    it("streams deltas that add up to the final assistant message, then ends the turn", async () => {
      const harness = await createHarness();
      const session = await harness.adapter.start(harness);
      await session.send(harness.shortPrompt);
      const events = await collectTurn(session);
      const finalMessage = events.find((event) => event.type === "assistant.message");
      const streamedText = events
        .flatMap((event) => (event.type === "assistant.delta" ? [event.text] : []))
        .join("");
      expect(finalMessage?.text.length).toBeGreaterThan(0);
      expect(streamedText).toBe(finalMessage?.text);
      expect(events.at(-1)).toMatchObject({ type: "turn.completed", reason: "end" });
      await session.close();
    });

    it("resumes a closed session by its backend session id", async () => {
      const harness = await createHarness();
      const first = await harness.adapter.start(harness);
      await first.send(harness.shortPrompt);
      await collectTurn(first);
      await first.close();
      const resumed = await harness.adapter.resume({
        ...harness,
        backendSessionId: first.backendSessionId,
      });
      expect(resumed.backendSessionId).toBe(first.backendSessionId);
      await resumed.send(harness.shortPrompt);
      expect((await collectTurn(resumed)).at(-1)).toMatchObject({ reason: "end" });
      await resumed.close();
    });

    it("ends an interrupted turn with reason interrupted", async () => {
      const harness = await createHarness();
      const session = await harness.adapter.start(harness);
      await session.send(harness.longRunningPrompt);
      await session.interrupt();
      expect((await collectTurn(session)).at(-1)).toMatchObject({ reason: "interrupted" });
      await session.close();
    });

    it("rejects resuming an unknown session with BackendSessionNotFoundError", async () => {
      const harness = await createHarness();
      await expect(
        harness.adapter.resume({ ...harness, backendSessionId: "does-not-exist" }),
      ).rejects.toBeInstanceOf(BackendSessionNotFoundError);
    });
  });
}
