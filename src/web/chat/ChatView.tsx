import type { SessionSummary } from "../../shared/session.ts";
import { useServices } from "../app/services.tsx";
import { ChatHeader } from "./ChatHeader.tsx";
import { Composer } from "./Composer.tsx";
import { TranscriptView } from "./TranscriptView.tsx";
import { useSessionTranscript } from "./use-session-transcript.ts";

interface ChatViewProps {
  session: SessionSummary;
  onDeleted(): void;
}

export function ChatView({ session, onDeleted }: ChatViewProps) {
  const { api } = useServices();
  const transcript = useSessionTranscript(session.id);
  const busy = session.status === "starting" || session.status === "running";
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="Chat">
      <ChatHeader
        session={session}
        onRename={async (title) => {
          await api.renameSession(session.id, title);
        }}
        onDelete={async () => {
          await api.deleteSession(session.id);
          onDeleted();
        }}
      />
      <TranscriptView items={transcript.items} />
      <Composer
        busy={busy}
        onSend={(text) => api.sendMessage(session.id, text)}
        onInterrupt={() => api.interrupt(session.id)}
      />
    </section>
  );
}
