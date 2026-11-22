import { type FormEvent, useState } from "react";
import type { SessionSummary } from "../../shared/session.ts";

interface ChatHeaderProps {
  session: SessionSummary;
  onRename(title: string): Promise<void>;
  onDelete(): Promise<void>;
}

export function ChatHeader({ session, onRename, onDelete }: ChatHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);

  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    if (draft.trim().length > 0) {
      await onRename(draft.trim());
    }
    setEditing(false);
  };

  const confirmDelete = () => {
    if (window.confirm(`Delete "${session.title}"? Its history will be lost.`)) {
      void onDelete();
    }
  };

  return (
    <header className="flex items-center gap-4 border-b border-zinc-800 px-6 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={(event) => void submitRename(event)}>
            <input
              aria-label="Session title"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => setEditing(false)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
            />
          </form>
        ) : (
          <button
            type="button"
            title="Rename"
            onClick={() => {
              setDraft(session.title);
              setEditing(true);
            }}
            className="block max-w-full truncate text-left text-sm font-medium text-zinc-100 hover:text-sky-300"
          >
            {session.title}
          </button>
        )}
        <p className="truncate text-xs text-zinc-500" title={session.workingDirectory}>
          {session.backendId} · {session.model} · {session.workingDirectory}
        </p>
      </div>
      {session.errorMessage && session.status === "error" && (
        <span className="max-w-xs truncate text-xs text-red-400" title={session.errorMessage}>
          {session.errorMessage}
        </span>
      )}
      <button
        type="button"
        onClick={confirmDelete}
        className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
      >
        Delete
      </button>
    </header>
  );
}
