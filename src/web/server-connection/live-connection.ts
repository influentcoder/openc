import type { SessionId } from "../../shared/ids.ts";
import {
  type ClientMessage,
  type ServerMessage,
  ServerMessageSchema,
} from "../../shared/live-protocol.ts";

export type SessionListMessage = Extract<
  ServerMessage,
  { type: "session.updated" | "session.deleted" }
>;
export type SessionStreamMessage = Extract<
  ServerMessage,
  { type: "session.event" | "session.delta" }
>;

export interface LiveConnection {
  subscribeToSession(
    sessionId: SessionId,
    listener: (message: SessionStreamMessage) => void,
  ): () => void;
  subscribeToSessionList(listener: (message: SessionListMessage) => void): () => void;
}

interface SessionSubscription {
  lastSeq: number;
  listeners: Set<(message: SessionStreamMessage) => void>;
}

const maximumReconnectDelayMilliseconds = 10_000;

export class WebSocketLiveConnection implements LiveConnection {
  private readonly url: string;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly sessionSubscriptions = new Map<SessionId, SessionSubscription>();
  private readonly sessionListListeners = new Set<(message: SessionListMessage) => void>();

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  subscribeToSession(sessionId: SessionId, listener: (message: SessionStreamMessage) => void) {
    const existing = this.sessionSubscriptions.get(sessionId);
    const subscription = existing ?? { lastSeq: 0, listeners: new Set() };
    subscription.listeners.add(listener);
    if (!existing) {
      this.sessionSubscriptions.set(sessionId, subscription);
      this.send({ type: "subscribe", sessionId, sinceSeq: 0 });
    }
    return () => {
      subscription.listeners.delete(listener);
      if (subscription.listeners.size === 0) {
        this.sessionSubscriptions.delete(sessionId);
        this.send({ type: "unsubscribe", sessionId });
      }
    };
  }

  subscribeToSessionList(listener: (message: SessionListMessage) => void) {
    this.sessionListListeners.add(listener);
    return () => {
      this.sessionListListeners.delete(listener);
    };
  }

  private connect(): void {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.reconnectAttempts = 0;
      for (const [sessionId, subscription] of this.sessionSubscriptions) {
        this.send({ type: "subscribe", sessionId, sinceSeq: subscription.lastSeq });
      }
    });
    socket.addEventListener("message", (event) => this.receive(String(event.data)));
    socket.addEventListener("close", () => this.scheduleReconnect());
  }

  private scheduleReconnect(): void {
    this.socket = null;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, maximumReconnectDelayMilliseconds);
    this.reconnectAttempts += 1;
    setTimeout(() => this.connect(), delay);
  }

  private receive(data: string): void {
    const message = ServerMessageSchema.parse(JSON.parse(data));
    if (message.type === "session.updated" || message.type === "session.deleted") {
      for (const listener of this.sessionListListeners) {
        listener(message);
      }
      return;
    }
    const sessionId =
      message.type === "session.event" ? message.envelope.sessionId : message.delta.sessionId;
    const subscription = this.sessionSubscriptions.get(sessionId);
    if (!subscription) {
      return;
    }
    if (message.type === "session.event") {
      subscription.lastSeq = Math.max(subscription.lastSeq, message.envelope.seq);
    }
    for (const listener of subscription.listeners) {
      listener(message);
    }
  }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}
