import type { BackendInfo, CreateSessionRequest, NewSessionDefaults } from "../../shared/api.ts";
import type { BackendId } from "../../shared/ids.ts";
import type { WorkspaceMode } from "../../shared/session.ts";

export interface NewSessionForm {
  backendId: BackendId | null;
  model: string | null;
  workspaceMode: WorkspaceMode;
  directoryPath: string | null;
}

export function initialNewSessionForm(
  backends: BackendInfo[],
  defaults: NewSessionDefaults,
): NewSessionForm {
  const available = backends.filter((backend) => backend.available);
  const backend =
    available.find((candidate) => candidate.id === defaults.backendId) ?? available[0];
  const model =
    backend?.models.find((candidate) => candidate.id === defaults.model) ?? backend?.models[0];
  return {
    backendId: backend?.id ?? null,
    model: model?.id ?? null,
    workspaceMode: defaults.workspaceMode,
    directoryPath: defaults.recentDirectories[0] ?? null,
  };
}

export function withBackend(
  form: NewSessionForm,
  backends: BackendInfo[],
  backendId: BackendId,
): NewSessionForm {
  const backend = backends.find((candidate) => candidate.id === backendId);
  return { ...form, backendId, model: backend?.models[0]?.id ?? null };
}

export type FormValidation =
  | { valid: true; request: CreateSessionRequest }
  | { valid: false; problem: string };

export function validateNewSessionForm(form: NewSessionForm): FormValidation {
  if (form.backendId === null) {
    return { valid: false, problem: "No backend is available" };
  }
  if (form.model === null) {
    return { valid: false, problem: "Choose a model" };
  }
  if (form.workspaceMode === "scratch") {
    return {
      valid: true,
      request: { backendId: form.backendId, model: form.model, workspace: { mode: "scratch" } },
    };
  }
  if (form.directoryPath === null) {
    return { valid: false, problem: "Choose a folder" };
  }
  return {
    valid: true,
    request: {
      backendId: form.backendId,
      model: form.model,
      workspace: { mode: "directory", path: form.directoryPath },
    },
  };
}
