import type { ModelInfo } from "../../../shared/api.ts";

export interface ClaudeConversationOptions {
  sessionId: string;
  resume: boolean;
  workingDirectory: string;
  model: string;
}

export interface ClaudeConversation {
  readonly messages: AsyncIterable<unknown>;
  send(text: string): void;
  interrupt(): Promise<void>;
  close(): void;
}

export interface ClaudeAccount {
  models: ModelInfo[];
  subscriptionType: string | null;
  apiKeySource: string | null;
}

export interface ClaudeAgentClient {
  openConversation(options: ClaudeConversationOptions): ClaudeConversation;
  conversationExists(sessionId: string, workingDirectory: string): Promise<boolean>;
  describeAccount(): Promise<ClaudeAccount>;
}
