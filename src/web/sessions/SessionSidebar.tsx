import type { SessionId } from "../../shared/ids.ts";
import type { SessionSummary } from "../../shared/session.ts";
import { StatusIndicator } from "./StatusIndicator.tsx";
import { workspaceLabel } from "./workspace-label.ts";

interface SessionSidebarProps {
  sessions: SessionSummary[];
  selectedSessionId: SessionId | null;
  onSelect(sessionId: SessionId): void;
  onNewSession(): void;
}

export function SessionSidebar(props: SessionSidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold tracking-wide text-zinc-300">openc</span>
        <button
          type="button"
          onClick={props.onNewSession}
          className="rounded-md bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-500"
        >
          New session
        </button>
      </div>
      <nav aria-label="Sessions" className="flex-1 overflow-y-auto px-2 pb-4">
        {props.sessions.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-zinc-500">No sessions yet</p>
        ) : (
          <ul className="space-y-0.5">
            {props.sessions.map((session) => (
              <li key={session.id}>
                <SessionRow
                  session={session}
                  selected={session.id === props.selectedSessionId}
                  onSelect={() => props.onSelect(session.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function SessionRow(props: { session: SessionSummary; selected: boolean; onSelect(): void }) {
  const { session } = props;
  return (
    <button
      type="button"
      onClick={props.onSelect}
      aria-current={props.selected ? "page" : undefined}
      className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left ${
        props.selected ? "bg-zinc-800" : "hover:bg-zinc-800/60"
      }`}
    >
      <StatusIndicator session={session} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-zinc-100">{session.title}</span>
        <span className="block truncate text-xs text-zinc-500">
          {session.model} · {workspaceLabel(session)}
        </span>
      </span>
    </button>
  );
}
