import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import type { BackendInfo, NewSessionDefaults } from "../../shared/api.ts";
import { BackendIdSchema } from "../../shared/ids.ts";
import type { SessionSummary } from "../../shared/session.ts";
import { useServices } from "../app/services.tsx";
import { FolderPicker } from "./FolderPicker.tsx";
import { initialNewSessionForm, validateNewSessionForm, withBackend } from "./new-session-form.ts";

interface NewSessionDialogProps {
  onCreated(session: SessionSummary): void;
  onCancel(): void;
}

export function NewSessionDialog(props: NewSessionDialogProps) {
  const { api } = useServices();
  const backends = useQuery({ queryKey: ["backends"], queryFn: () => api.listBackends() });
  const defaults = useQuery({
    queryKey: ["new-session-defaults"],
    queryFn: () => api.newSessionDefaults(),
    staleTime: 0,
  });
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New session"
        className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl"
      >
        <h2 className="mb-4 text-base font-semibold text-zinc-100">New session</h2>
        {backends.data && defaults.data ? (
          <NewSessionFormView backends={backends.data} defaults={defaults.data} {...props} />
        ) : (
          <p className="text-sm text-zinc-400">{backends.error?.message ?? "Loading…"}</p>
        )}
      </div>
    </div>
  );
}

interface FormViewProps extends NewSessionDialogProps {
  backends: BackendInfo[];
  defaults: NewSessionDefaults;
}

function NewSessionFormView({ backends, defaults, onCreated, onCancel }: FormViewProps) {
  const { api } = useServices();
  const [form, setForm] = useState(() => initialNewSessionForm(backends, defaults));
  const [error, setError] = useState<string | null>(null);
  const selectedBackend = backends.find((backend) => backend.id === form.backendId);
  const validation = validateNewSessionForm(form);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation.valid) {
      return;
    }
    try {
      onCreated(await api.createSession(validation.request));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs text-zinc-400">Backend</span>
          <select
            value={form.backendId ?? ""}
            onChange={(event) =>
              setForm(withBackend(form, backends, BackendIdSchema.parse(event.target.value)))
            }
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5"
          >
            {backends.map((backend) => (
              <option key={backend.id} value={backend.id} disabled={!backend.available}>
                {backend.displayName}
                {backend.available ? "" : " (unavailable)"}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-zinc-400">Model</span>
          <select
            value={form.model ?? ""}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5"
          >
            {selectedBackend?.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs text-zinc-400">Workspace</legend>
        <div className="flex gap-4">
          <WorkspaceOption
            label="No folder (scratch)"
            checked={form.workspaceMode === "scratch"}
            onChange={() => setForm({ ...form, workspaceMode: "scratch" })}
          />
          <WorkspaceOption
            label="Folder"
            checked={form.workspaceMode === "directory"}
            onChange={() => setForm({ ...form, workspaceMode: "directory" })}
          />
        </div>
      </fieldset>
      {form.workspaceMode === "directory" && (
        <FolderPicker
          selectedPath={form.directoryPath}
          recentDirectories={defaults.recentDirectories}
          onSelect={(directoryPath) => setForm({ ...form, directoryPath })}
        />
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && !validation.valid && <p className="text-xs text-zinc-400">{validation.problem}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!validation.valid}
          className="rounded-md bg-sky-600 px-3 py-1.5 font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          Create session
        </button>
      </div>
    </form>
  );
}

function WorkspaceOption(props: { label: string; checked: boolean; onChange(): void }) {
  return (
    <label className="flex items-center gap-2 text-zinc-200">
      <input type="radio" name="workspace" checked={props.checked} onChange={props.onChange} />
      {props.label}
    </label>
  );
}
