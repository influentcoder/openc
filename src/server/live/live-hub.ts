import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { type WebSocket, WebSocketServer } from "ws";
import type { SessionId } from "../../shared/ids.ts";
import {
  type ClientMessage,
  ClientMessageSchema,
  type ServerMessage,
} from "../../shared/live-protocol.ts";
import type { Services } from "../composition.ts";
import { isAllowedOrigin, isLoopbackHost, tokensMatch } from "../http/access-guard.ts";

export const livePath = "/ws";

export class LiveHub {
  private readonly server = new WebSocketServer({ noServer: true });
  private readonly services: Services;
  private readonly token: string;
  private readonly subscriptions = new Map<WebSocket, Set<SessionId>>();
  private readonly stopListening: () => void;

  constructor(services: Services, token: string) {
    this.services = services;
    this.token = token;
    this.server.on("connection", (socket) => this.accept(socket));
    this.stopListening = services.notifications.subscribe((message) => this.broadcast(message));
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(request.url ?? "/", "http://localhost");
    const allowed =
      url.pathname === livePath &&
      isLoopbackHost(request.headers.host) &&
      isAllowedOrigin(request.headers.origin) &&
      tokensMatch(this.token, url.searchParams.get("token"));
    if (!allowed) {
      socket.end("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return;
    }
    this.server.handleUpgrade(request, socket, head, (webSocket) => {
      this.server.emit("connection", webSocket, request);
    });
  }

  async close(): Promise<void> {
    this.stopListening();
    for (const socket of this.subscriptions.keys()) {
      socket.terminate();
    }
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  private accept(socket: WebSocket): void {
    this.subscriptions.set(socket, new Set());
    socket.on("message", (data) => this.receive(socket, String(data)));
    socket.on("close", () => this.disconnect(socket));
  }

  private receive(socket: WebSocket, data: string): void {
    const parsed = ClientMessageSchema.safeParse(safeJson(data));
    if (!parsed.success) {
      this.services.logger.warn({ data }, "Ignoring malformed live message");
      return;
    }
    try {
      this.handleClientMessage(socket, parsed.data);
    } catch (error) {
      this.services.logger.warn(
        { error, message: parsed.data },
        "Live message could not be handled",
      );
    }
  }

  private handleClientMessage(socket: WebSocket, message: ClientMessage): void {
    const sessions = this.subscriptions.get(socket);
    if (!sessions) {
      return;
    }
    if (message.type === "unsubscribe") {
      if (sessions.delete(message.sessionId)) {
        this.services.viewers.remove(message.sessionId);
      }
      return;
    }
    const backlog = this.services.sessions.eventsSince(message.sessionId, message.sinceSeq);
    if (!sessions.has(message.sessionId)) {
      sessions.add(message.sessionId);
      this.services.viewers.add(message.sessionId);
    }
    for (const envelope of backlog) {
      send(socket, { type: "session.event", envelope });
    }
  }

  private disconnect(socket: WebSocket): void {
    for (const sessionId of this.subscriptions.get(socket) ?? []) {
      this.services.viewers.remove(sessionId);
    }
    this.subscriptions.delete(socket);
  }

  private broadcast(message: ServerMessage): void {
    const sessionId = sessionOf(message);
    for (const [socket, sessions] of this.subscriptions) {
      if (sessionId === null || sessions.has(sessionId)) {
        send(socket, message);
      }
    }
  }
}

function sessionOf(message: ServerMessage): SessionId | null {
  switch (message.type) {
    case "session.event":
      return message.envelope.sessionId;
    case "session.delta":
      return message.delta.sessionId;
    case "session.updated":
    case "session.deleted":
      return null;
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function safeJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}
