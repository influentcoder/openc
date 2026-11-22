import type { ServerMessage } from "../../shared/live-protocol.ts";

export type SessionNotificationListener = (message: ServerMessage) => void;

export class SessionNotifications {
  private readonly listeners = new Set<SessionNotificationListener>();

  publish(message: ServerMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  subscribe(listener: SessionNotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
