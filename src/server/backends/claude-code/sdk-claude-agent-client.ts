import {
  getSessionInfo,
  type Query,
  query,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { AsyncQueue } from "../../platform/async-queue.ts";
import type { Logger } from "../../platform/logger.ts";
import type {
  ClaudeAccount,
  ClaudeAgentClient,
  ClaudeConversation,
  ClaudeConversationOptions,
} from "./claude-agent-client.ts";
import { FixtureRecorder } from "./fixture-recorder.ts";
import { buildQueryOptions } from "./query-options.ts";

export interface SdkClaudeAgentClientOptions {
  logger: Logger;
  recordingDirectory: string | undefined;
}

export class SdkClaudeAgentClient implements ClaudeAgentClient {
  private readonly options: SdkClaudeAgentClientOptions;

  constructor(options: SdkClaudeAgentClientOptions) {
    this.options = options;
  }

  openConversation(conversation: ClaudeConversationOptions): ClaudeConversation {
    const recorder = this.options.recordingDirectory
      ? new FixtureRecorder(
          this.options.recordingDirectory,
          conversation.sessionId,
          conversation.workingDirectory,
        )
      : null;
    const logger = this.options.logger.child({ backendSessionId: conversation.sessionId });
    return new SdkClaudeConversation(conversation, logger, recorder);
  }

  async conversationExists(sessionId: string, workingDirectory: string): Promise<boolean> {
    return (await getSessionInfo(sessionId, { dir: workingDirectory })) !== undefined;
  }

  async describeAccount(): Promise<ClaudeAccount> {
    const prompts = new AsyncQueue<SDKUserMessage>();
    const probe = query({ prompt: prompts, options: { settingSources: ["user"] } });
    try {
      const [models, account] = await Promise.all([probe.supportedModels(), probe.accountInfo()]);
      return {
        models: models.map((model) => ({ id: model.value, displayName: model.displayName })),
        subscriptionType: account.subscriptionType ?? null,
        apiKeySource: account.apiKeySource ?? null,
      };
    } finally {
      prompts.close();
      probe.close();
    }
  }
}

class SdkClaudeConversation implements ClaudeConversation {
  readonly messages: AsyncIterable<unknown>;
  private readonly prompts = new AsyncQueue<SDKUserMessage>();
  private readonly query: Query;
  private readonly recorder: FixtureRecorder | null;

  constructor(
    options: ClaudeConversationOptions,
    logger: Logger,
    recorder: FixtureRecorder | null,
  ) {
    this.recorder = recorder;
    this.query = query({
      prompt: this.prompts,
      options: buildQueryOptions(options, (data) =>
        logger.debug({ stderr: data }, "Claude Code stderr"),
      ),
    });
    this.messages = recorder ? recorder.recordMessages(this.query) : this.query;
  }

  send(text: string): void {
    this.recorder?.recordPrompt(text);
    this.prompts.push({
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
      origin: { kind: "human" },
    });
  }

  async interrupt(): Promise<void> {
    await this.query.interrupt();
  }

  close(): void {
    if (!this.prompts.isClosed) {
      this.prompts.close();
    }
    this.query.close();
  }
}
