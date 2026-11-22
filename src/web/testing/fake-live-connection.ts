import type { SessionId } from "../../shared/ids.ts";
import type {
  LiveConnection,
  SessionListMessage,
  SessionStreamMessage,
} from "../api/live-connection.ts";

export class FakeLiveConnection implements LiveConnection {
  private readonly sessionListeners = new Map<
    SessionId,
    Set<(message: SessionStreamMessage) => void>
  >();
  private readonly listListeners = new Set<(message: SessionListMessage) => void>();

  subscribeToSession(sessionId: SessionId, listener: (message: SessionStreamMessage) => void) {
    const listeners = this.sessionListeners.get(sessionId) ?? new Set();
    listeners.add(listener);
    this.sessionListeners.set(sessionId, listeners);
    return () => {
      listeners.delete(listener);
    };
  }

  subscribeToSessionList(listener: (message: SessionListMessage) => void) {
    this.listListeners.add(listener);
    return () => {
      this.listListeners.delete(listener);
    };
  }

  emitToSession(sessionId: SessionId, message: SessionStreamMessage): void {
    for (const listener of this.sessionListeners.get(sessionId) ?? []) {
      listener(message);
    }
  }

  emitToSessionList(message: SessionListMessage): void {
    for (const listener of this.listListeners) {
      listener(message);
    }
  }
}
