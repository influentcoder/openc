import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChatView } from "../chat/ChatView.tsx";
import { NewSessionDialog } from "../new-session/NewSessionDialog.tsx";
import { SessionSidebar } from "../sessions/SessionSidebar.tsx";
import { rememberSession, useSessions } from "../sessions/use-sessions.ts";
import { useSelectedSession } from "./use-selected-session.ts";

export function App() {
  const sessions = useSessions();
  const queryClient = useQueryClient();
  const [selectedSessionId, selectSession] = useSelectedSession();
  const [creating, setCreating] = useState(false);
  const selectedSession = sessions.data?.find((session) => session.id === selectedSessionId);

  return (
    <div className="flex h-full">
      <SessionSidebar
        sessions={sessions.data ?? []}
        selectedSessionId={selectedSessionId}
        onSelect={selectSession}
        onNewSession={() => setCreating(true)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        {selectedSession ? (
          <ChatView
            key={selectedSession.id}
            session={selectedSession}
            onDeleted={() => selectSession(null)}
          />
        ) : (
          <EmptyState onNewSession={() => setCreating(true)} error={sessions.error?.message} />
        )}
      </main>
      {creating && (
        <NewSessionDialog
          onCancel={() => setCreating(false)}
          onCreated={(session) => {
            rememberSession(queryClient, session);
            setCreating(false);
            selectSession(session.id);
          }}
        />
      )}
    </div>
  );
}

function EmptyState(props: { onNewSession(): void; error: string | undefined }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-400">
      {props.error && <p className="text-sm text-red-400">{props.error}</p>}
      <p className="text-sm">Select a session or start a new one.</p>
      <button
        type="button"
        onClick={props.onNewSession}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        New session
      </button>
    </div>
  );
}
