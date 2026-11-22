import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { temporaryDirectoryFactory } from "../../testing/temporary-directory.ts";
import { FixtureRecorder, scrubForFixture } from "./fixture-recorder.ts";

const createTemporaryDirectory = temporaryDirectoryFactory();

async function* fromArray(items: unknown[]): AsyncGenerator<unknown> {
  yield* items;
}

describe("Claude fixture recording", () => {
  it("keeps only the identifying fields of system messages", () => {
    const init = {
      type: "system",
      subtype: "init",
      session_id: "s1",
      model: "claude-haiku-5-5",
      cwd: "/somewhere",
      tools: ["Bash"],
      plugins: [{ name: "private-plugin" }],
    };
    expect(scrubForFixture(init, "/work")).toEqual({
      type: "system",
      subtype: "init",
      session_id: "s1",
      model: "claude-haiku-5-5",
    });
  });

  it("replaces the working directory and home directory with placeholders", () => {
    const message = { type: "user", text: `/work/src and ${join(homedir(), ".claude")}` };
    expect(scrubForFixture(message, "/work")).toEqual({
      type: "user",
      text: "<workdir>/src and <home>/.claude",
    });
  });

  it("writes prompts and scrubbed messages as fixture lines while passing messages through", async () => {
    const directory = await createTemporaryDirectory();
    const recorder = new FixtureRecorder(directory, "session-1", "/work");
    recorder.recordPrompt("hello");
    const passedThrough: unknown[] = [];
    for await (const message of recorder.recordMessages(
      fromArray([{ type: "result", cwd: "/work" }]),
    )) {
      passedThrough.push(message);
    }
    expect(passedThrough).toEqual([{ type: "result", cwd: "/work" }]);
    const lines = readFileSync(join(directory, "session-1.jsonl"), "utf8").trim().split("\n");
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { direction: "in", text: "hello" },
      { direction: "out", message: { type: "result", cwd: "<workdir>" } },
    ]);
  });
});
