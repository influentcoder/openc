import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { SessionSummary } from "../../shared/session.ts";
import type { SessionListMessage } from "../api/live-connection.ts";
import { useServices } from "../app/services.tsx";

export const sessionsQueryKey = ["sessions"] as const;

export function useSessions() {
  const { api, live } = useServices();
  const queryClient = useQueryClient();
  useEffect(
    () => live.subscribeToSessionList((message) => applySessionListMessage(queryClient, message)),
    [live, queryClient],
  );
  return useQuery({ queryKey: sessionsQueryKey, queryFn: () => api.listSessions() });
}

export function rememberSession(queryClient: QueryClient, session: SessionSummary) {
  applySessionListMessage(queryClient, { type: "session.updated", session });
}

export function applySessionListMessage(queryClient: QueryClient, message: SessionListMessage) {
  queryClient.setQueryData<SessionSummary[]>(sessionsQueryKey, (current = []) => {
    if (message.type === "session.deleted") {
      return current.filter((session) => session.id !== message.sessionId);
    }
    const others = current.filter((session) => session.id !== message.session.id);
    return sortByRecentActivity([...others, message.session]);
  });
}

function sortByRecentActivity(sessions: SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((first, second) =>
    second.lastActivityAt.localeCompare(first.lastActivityAt),
  );
}
