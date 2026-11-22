import { useEffect, useReducer } from "react";
import type { SessionId } from "../../shared/ids.ts";
import type { SessionStreamMessage } from "../api/live-connection.ts";
import { useServices } from "../app/services.tsx";
import {
  applyDelta,
  applyEnvelope,
  emptyTranscript,
  type TranscriptState,
} from "./transcript-state.ts";

type TranscriptAction = { type: "reset" } | { type: "message"; message: SessionStreamMessage };

function reduceTranscript(state: TranscriptState, action: TranscriptAction): TranscriptState {
  if (action.type === "reset") {
    return emptyTranscript;
  }
  const { message } = action;
  return message.type === "session.event"
    ? applyEnvelope(state, message.envelope)
    : applyDelta(state, message.delta);
}

export function useSessionTranscript(sessionId: SessionId): TranscriptState {
  const { live } = useServices();
  const [state, dispatch] = useReducer(reduceTranscript, emptyTranscript);
  useEffect(() => {
    dispatch({ type: "reset" });
    return live.subscribeToSession(sessionId, (message) => dispatch({ type: "message", message }));
  }, [live, sessionId]);
  return state;
}
