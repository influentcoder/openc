import { describe, expect, it } from "vitest";
import { buildQueryOptions } from "./query-options.ts";

const ignoreStandardError = () => {};
const conversation = {
  sessionId: "4b9f0a8e-1d2c-4e5f-8a9b-0c1d2e3f4a5b",
  resume: false,
  workingDirectory: "/home/user/project",
  model: "haiku",
};

describe("Claude Agent SDK query options", () => {
  it("R-CHAT-7 never asks for permission and loads the user's Claude Code settings", () => {
    expect(buildQueryOptions(conversation, ignoreStandardError)).toMatchObject({
      cwd: "/home/user/project",
      model: "haiku",
      sessionId: conversation.sessionId,
      includePartialMessages: true,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      settingSources: ["user", "project", "local"],
    });
  });

  it("resumes by session id instead of creating one", () => {
    const options = buildQueryOptions({ ...conversation, resume: true }, ignoreStandardError);
    expect(options.resume).toBe(conversation.sessionId);
    expect(options.sessionId).toBeUndefined();
  });

  it("lets Claude Code pick the model for the default alias", () => {
    const options = buildQueryOptions({ ...conversation, model: "default" }, ignoreStandardError);
    expect(options.model).toBeUndefined();
  });
});
