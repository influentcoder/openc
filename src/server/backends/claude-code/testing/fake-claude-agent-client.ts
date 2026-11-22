import type { ModelInfo } from "../../../../shared/api.ts";
import { AsyncQueue } from "../../../platform/async-queue.ts";
import type {
  ClaudeAccount,
  ClaudeAgentClient,
  ClaudeConversation,
  ClaudeConversationOptions,
} from "../claude-agent-client.ts";
import { type FixtureTurn, fixtureTurns, loadClaudeFixture } from "./claude-fixtures.ts";

export const fakeClaudeModels: ModelInfo[] = [
  { id: "default", displayName: "Default (recommended)" },
  { id: "haiku", displayName: "Haiku" },
];

export class FakeClaudeAgentClient implements ClaudeAgentClient {
  readonly openedConversations: ClaudeConversationOptions[] = [];
  readonly conversations: FakeClaudeConversation[] = [];
  account: ClaudeAccount | Error = {
    models: fakeClaudeModels,
    subscriptionType: "max",
    apiKeySource: "none",
  };
  describeAccountCalls = 0;
  private readonly turnsByPrompt = new Map<string, FixtureTurn>();
  private readonly startedSessions = new Set<string>();

  constructor(fixtureNames: string[]) {
    for (const turn of fixtureNames.flatMap((name) => fixtureTurns(loadClaudeFixture(name)))) {
      this.turnsByPrompt.set(turn.prompt, turn);
    }
  }

  openConversation(options: ClaudeConversationOptions): ClaudeConversation {
    this.openedConversations.push(options);
    const conversation = new FakeClaudeConversation((prompt) => {
      this.startedSessions.add(options.sessionId);
      const turn = this.turnsByPrompt.get(prompt);
      if (!turn) {
        throw new Error(`No fixture turn for prompt: ${prompt}`);
      }
      return turn;
    });
    this.conversations.push(conversation);
    return conversation;
  }

  async conversationExists(sessionId: string): Promise<boolean> {
    return this.startedSessions.has(sessionId);
  }

  async describeAccount(): Promise<ClaudeAccount> {
    this.describeAccountCalls += 1;
    if (this.account instanceof Error) {
      throw this.account;
    }
    return this.account;
  }
}

export class FakeClaudeConversation implements ClaudeConversation {
  readonly messages = new AsyncQueue<unknown>();
  private readonly turnFor: (prompt: string) => FixtureTurn;
  private replaying = false;
  private interruptRequested = false;

  constructor(turnFor: (prompt: string) => FixtureTurn) {
    this.turnFor = turnFor;
  }

  send(text: string): void {
    void this.replay(this.turnFor(text));
  }

  async interrupt(): Promise<void> {
    this.interruptRequested = this.replaying;
  }

  close(): void {
    if (!this.messages.isClosed) {
      this.messages.close();
    }
  }

  crash(error: Error): void {
    this.messages.fail(error);
  }

  private async replay(turn: FixtureTurn): Promise<void> {
    this.replaying = true;
    for (const message of turn.messages) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (this.messages.isClosed) {
        return;
      }
      if (this.interruptRequested) {
        this.messages.push(turn.messages.at(-1));
        break;
      }
      this.messages.push(message);
    }
    this.replaying = false;
    this.interruptRequested = false;
  }
}
