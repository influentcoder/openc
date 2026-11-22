import { describe, expect, it } from "vitest";
import { sequentialIds } from "../../testing/sequential-ids.ts";
import { temporaryDirectoryFactory } from "../../testing/temporary-directory.ts";
import { collectTurn, describeBackendAdapterContract } from "../backend-adapter.contract.ts";
import { FakeBackendAdapter } from "./fake-backend-adapter.ts";

const createTemporaryDirectory = temporaryDirectoryFactory();
const immediatePace = () => new Promise<void>((resolve) => setImmediate(resolve));

async function createFakeHarness() {
  return {
    adapter: new FakeBackendAdapter({ ids: sequentialIds(), pace: immediatePace }),
    workingDirectory: await createTemporaryDirectory(),
    model: "fake-fast",
    shortPrompt: "hello",
    longRunningPrompt: "please be slow",
  };
}

describeBackendAdapterContract("FakeBackendAdapter", createFakeHarness);

describe("FakeBackendAdapter specifics", () => {
  it("numbers replies across resumes, proving the conversation is kept", async () => {
    const harness = await createFakeHarness();
    const first = await harness.adapter.start(harness);
    await first.send("one");
    await collectTurn(first);
    await first.close();
    const resumed = await harness.adapter.resume({
      ...harness,
      backendSessionId: first.backendSessionId,
    });
    await resumed.send("two");
    const events = await collectTurn(resumed);
    expect(events.find((event) => event.type === "assistant.message")?.text).toBe("Echo #2: two");
  });

  it("runs a fake tool that lists the working directory when asked for a tool", async () => {
    const harness = await createFakeHarness();
    const session = await harness.adapter.start(harness);
    await session.send("use a tool");
    const events = await collectTurn(session);
    expect(events.find((event) => event.type === "tool.completed")).toMatchObject({
      output: "(empty directory)",
      isError: false,
    });
  });

  it("ends the turn with an error when asked to fail", async () => {
    const harness = await createFakeHarness();
    const session = await harness.adapter.start(harness);
    await session.send("please fail");
    expect((await collectTurn(session)).at(-1)).toMatchObject({
      reason: "error",
      errorMessage: "Simulated backend failure",
    });
  });
});
