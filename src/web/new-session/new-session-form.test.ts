import { describe, expect, it } from "vitest";
import type { BackendInfo, NewSessionDefaults } from "../../shared/api.ts";
import { BackendIdSchema } from "../../shared/ids.ts";
import { initialNewSessionForm, validateNewSessionForm, withBackend } from "./new-session-form.ts";

const claude = BackendIdSchema.parse("claude-code");
const fake = BackendIdSchema.parse("fake");

const backends: BackendInfo[] = [
  {
    id: claude,
    displayName: "Claude Code",
    available: false,
    statusDetail: "",
    models: [{ id: "opus", displayName: "Opus" }],
  },
  {
    id: fake,
    displayName: "Fake",
    available: true,
    statusDetail: "",
    models: [
      { id: "fake-fast", displayName: "Fast" },
      { id: "fake-thorough", displayName: "Thorough" },
    ],
  },
];

const noDefaults: NewSessionDefaults = {
  backendId: null,
  model: null,
  workspaceMode: "scratch",
  recentDirectories: [],
  browseRoot: "/home/user",
};

describe("R-SES-3 new session form defaults", () => {
  it("picks the first available backend and model when nothing was used before", () => {
    expect(initialNewSessionForm(backends, noDefaults)).toEqual({
      backendId: fake,
      model: "fake-fast",
      workspaceMode: "scratch",
      directoryPath: null,
    });
  });

  it("restores the last used backend, model, workspace mode and folder", () => {
    const defaults: NewSessionDefaults = {
      ...noDefaults,
      backendId: fake,
      model: "fake-thorough",
      workspaceMode: "directory",
      recentDirectories: ["/home/user/project"],
    };
    expect(initialNewSessionForm(backends, defaults)).toEqual({
      backendId: fake,
      model: "fake-thorough",
      workspaceMode: "directory",
      directoryPath: "/home/user/project",
    });
  });

  it("selects the first model of a newly chosen backend", () => {
    const form = initialNewSessionForm(backends, noDefaults);
    expect(withBackend(form, backends, claude).model).toBe("opus");
  });
});

describe("new session form validation", () => {
  it("requires a folder in folder mode", () => {
    const form = {
      ...initialNewSessionForm(backends, noDefaults),
      workspaceMode: "directory" as const,
    };
    expect(validateNewSessionForm(form)).toEqual({ valid: false, problem: "Choose a folder" });
    expect(validateNewSessionForm({ ...form, directoryPath: "/home/user/p" })).toMatchObject({
      valid: true,
      request: { workspace: { mode: "directory", path: "/home/user/p" } },
    });
  });

  it("explains when no backend is available", () => {
    const form = initialNewSessionForm([], noDefaults);
    expect(validateNewSessionForm(form)).toEqual({
      valid: false,
      problem: "No backend is available",
    });
  });
});
