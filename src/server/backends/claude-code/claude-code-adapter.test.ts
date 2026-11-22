import { describe, expect, it } from "vitest";
import { createLogger } from "../../platform/logger.ts";
import { sequentialIds } from "../../testing/sequential-ids.ts";
import { temporaryDirectoryFactory } from "../../testing/temporary-directory.ts";
import { collectTurn, describeBackendAdapterContract } from "../backend-adapter.contract.ts";
import { BackendSessionNotFoundError } from "../backend-adapter.ts";
import { ClaudeCodeAdapter } from "./claude-code-adapter.ts";
import { FakeClaudeAgentClient, fakeClaudeModels } from "./testing/fake-claude-agent-client.ts";

const createTemporaryDirectory = temporaryDirectoryFactory();
const fixtures = ["synthetic-pong", "synthetic-tool-use", "synthetic-interrupted-count"];

async function createHarness(client = new FakeClaudeAgentClient(fixtures)) {
  return {
    client,
    adapter: new ClaudeCodeAdapter({
      client,
      ids: sequentialIds("claude"),
      logger: createLogger("silent"),
    }),
    workingDirectory: await createTemporaryDirectory(),
    model: "haiku",
    shortPrompt: "Reply with the single word: pong",
    longRunningPrompt: "Count from 1 to 300, one number per line, with no other text.",
  };
}

describeBackendAdapterContract("ClaudeCodeAdapter on recorded messages", createHarness);

describe("R-BE-2 Claude Code adapter", () => {
  it("opens new conversations with a fresh session id and resumes them by that id", async () => {
    const harness = await createHarness();
    const first = await harness.adapter.start(harness);
    await first.send(harness.shortPrompt);
    await collectTurn(first);
    await first.close();
    await harness.adapter.resume({ ...harness, backendSessionId: first.backendSessionId });
    expect(harness.client.openedConversations).toEqual([
      {
        sessionId: "claude-1",
        resume: false,
        workingDirectory: harness.workingDirectory,
        model: "haiku",
      },
      {
        sessionId: "claude-1",
        resume: true,
        workingDirectory: harness.workingDirectory,
        model: "haiku",
      },
    ]);
  });

  it("refuses to resume a conversation Claude Code no longer has", async () => {
    const harness = await createHarness();
    const neverUsed = await harness.adapter.start(harness);
    await neverUsed.close();
    await expect(
      harness.adapter.resume({ ...harness, backendSessionId: neverUsed.backendSessionId }),
    ).rejects.toBeInstanceOf(BackendSessionNotFoundError);
  });

  it("R-BE-4 describes the login and lists models, reading the account only once", async () => {
    const harness = await createHarness();
    expect(await harness.adapter.status()).toEqual({
      available: true,
      detail: "Signed in with a Claude max plan",
    });
    expect(await harness.adapter.listModels()).toEqual(fakeClaudeModels);
    expect(harness.client.describeAccountCalls).toBe(1);
  });

  it("reports itself unavailable when the account cannot be read, and retries later", async () => {
    const harness = await createHarness();
    harness.client.account = new Error("Claude Code is not logged in");
    expect(await harness.adapter.status()).toEqual({
      available: false,
      detail: "Claude Code is not ready: Claude Code is not logged in",
    });
    expect(await harness.adapter.listModels()).toEqual([]);
    harness.client.account = {
      models: fakeClaudeModels,
      subscriptionType: null,
      apiKeySource: "ANTHROPIC_API_KEY",
    };
    expect(await harness.adapter.status()).toEqual({
      available: true,
      detail: "Using an API key (ANTHROPIC_API_KEY)",
    });
  });

  it("fails the event stream when the Claude Code process crashes", async () => {
    const harness = await createHarness();
    const session = await harness.adapter.start(harness);
    harness.client.conversations[0]?.crash(new Error("claude exited with code 1"));
    await expect(collectTurn(session)).rejects.toThrow("claude exited with code 1");
  });
});
