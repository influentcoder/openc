import type { ModelInfo } from "../../../shared/api.ts";
import { type BackendId, BackendIdSchema } from "../../../shared/ids.ts";
import type { IdGenerator } from "../../platform/id-generator.ts";
import type { Logger } from "../../platform/logger.ts";
import {
  type BackendAdapter,
  type BackendSession,
  BackendSessionNotFoundError,
  type BackendStatus,
  type ResumeOptions,
  type StartOptions,
} from "../backend-adapter.ts";
import type { ClaudeAccount, ClaudeAgentClient } from "./claude-agent-client.ts";
import { ClaudeCodeSession } from "./claude-code-session.ts";

export const claudeCodeBackendId: BackendId = BackendIdSchema.parse("claude-code");

export interface ClaudeCodeAdapterOptions {
  client: ClaudeAgentClient;
  ids: IdGenerator;
  logger: Logger;
}

export class ClaudeCodeAdapter implements BackendAdapter {
  readonly id = claudeCodeBackendId;
  readonly displayName = "Claude Code";
  private readonly options: ClaudeCodeAdapterOptions;
  private account: Promise<ClaudeAccount> | null = null;

  constructor(options: ClaudeCodeAdapterOptions) {
    this.options = options;
  }

  async status(): Promise<BackendStatus> {
    try {
      return { available: true, detail: describeLogin(await this.loadAccount()) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { available: false, detail: `Claude Code is not ready: ${reason}` };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      return (await this.loadAccount()).models;
    } catch {
      return [];
    }
  }

  async start(options: StartOptions): Promise<BackendSession> {
    return this.open(this.options.ids.next(), false, options);
  }

  async resume(options: ResumeOptions): Promise<BackendSession> {
    const exists = await this.options.client.conversationExists(
      options.backendSessionId,
      options.workingDirectory,
    );
    if (!exists) {
      throw new BackendSessionNotFoundError(options.backendSessionId);
    }
    return this.open(options.backendSessionId, true, options);
  }

  private open(sessionId: string, resume: boolean, options: StartOptions): BackendSession {
    const conversation = this.options.client.openConversation({
      sessionId,
      resume,
      workingDirectory: options.workingDirectory,
      model: options.model,
    });
    return new ClaudeCodeSession(sessionId, conversation, this.options.logger);
  }

  private loadAccount(): Promise<ClaudeAccount> {
    if (!this.account) {
      this.account = this.options.client.describeAccount().catch((error: unknown) => {
        this.account = null;
        this.options.logger.warn({ error }, "Could not read the Claude Code account");
        throw error;
      });
    }
    return this.account;
  }
}

function describeLogin(account: ClaudeAccount): string {
  if (account.subscriptionType) {
    return `Signed in with a Claude ${account.subscriptionType} plan`;
  }
  if (account.apiKeySource && account.apiKeySource !== "none") {
    return `Using an API key (${account.apiKeySource})`;
  }
  return "Ready";
}
