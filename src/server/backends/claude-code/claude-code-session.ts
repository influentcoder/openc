import { AsyncQueue } from "../../platform/async-queue.ts";
import type { Logger } from "../../platform/logger.ts";
import type { BackendEvent, BackendSession } from "../backend-adapter.ts";
import type { ClaudeConversation } from "./claude-agent-client.ts";
import { parseClaudeMessage } from "./claude-message-schema.ts";
import { ClaudeMessageTranslator } from "./claude-message-translator.ts";

export class ClaudeCodeSession implements BackendSession {
  readonly backendSessionId: string;
  readonly events = new AsyncQueue<BackendEvent>();
  private readonly conversation: ClaudeConversation;
  private readonly translator = new ClaudeMessageTranslator();
  private readonly logger: Logger;

  constructor(backendSessionId: string, conversation: ClaudeConversation, logger: Logger) {
    this.backendSessionId = backendSessionId;
    this.conversation = conversation;
    this.logger = logger.child({ backendSessionId });
    void this.pumpMessages();
  }

  async send(text: string): Promise<void> {
    if (this.events.isClosed) {
      throw new Error("The Claude Code session is closed");
    }
    this.conversation.send(text);
  }

  async interrupt(): Promise<void> {
    this.translator.noteInterruptRequested();
    await this.conversation.interrupt();
  }

  async close(): Promise<void> {
    this.conversation.close();
    if (!this.events.isClosed) {
      this.events.close();
    }
  }

  private async pumpMessages(): Promise<void> {
    try {
      for await (const raw of this.conversation.messages) {
        this.handleRawMessage(raw);
      }
      if (!this.events.isClosed) {
        this.events.close();
      }
    } catch (error) {
      if (!this.events.isClosed) {
        this.events.fail(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private handleRawMessage(raw: unknown): void {
    const parsed = parseClaudeMessage(raw);
    if (parsed.kind === "invalid") {
      this.logger.warn(
        { messageType: parsed.type, problem: parsed.problem },
        "Ignoring a Claude message that does not match the expected shape",
      );
      return;
    }
    if (parsed.kind === "ignored") {
      return;
    }
    for (const event of this.translator.translate(parsed.message)) {
      if (!this.events.isClosed) {
        this.events.push(event);
      }
    }
  }
}
