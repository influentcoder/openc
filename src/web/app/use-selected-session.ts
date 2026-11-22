import { useCallback, useEffect, useState } from "react";
import { type SessionId, SessionIdSchema } from "../../shared/ids.ts";

const sessionHashPrefix = "#/sessions/";

function readSelectedSession(): SessionId | null {
  const { hash } = window.location;
  if (!hash.startsWith(sessionHashPrefix)) {
    return null;
  }
  const parsed = SessionIdSchema.safeParse(
    decodeURIComponent(hash.slice(sessionHashPrefix.length)),
  );
  return parsed.success ? parsed.data : null;
}

export function useSelectedSession(): [SessionId | null, (sessionId: SessionId | null) => void] {
  const [selected, setSelected] = useState(readSelectedSession);
  useEffect(() => {
    const onHashChange = () => setSelected(readSelectedSession());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const select = useCallback((sessionId: SessionId | null) => {
    window.location.hash = sessionId ? `${sessionHashPrefix}${encodeURIComponent(sessionId)}` : "";
    setSelected(sessionId);
  }, []);
  return [selected, select];
}
