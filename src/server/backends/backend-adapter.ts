import type { ModelInfo } from "../../shared/api.ts";
import type { ToolKind, TurnEndReason } from "../../shared/events.ts";
import type { BackendId } from "../../shared/ids.ts";

export type BackendEvent =
  | { type: "assistant.delta"; messageId: string; text: string }
  | { type: "assistant.message"; messageId: string; text: string }
  | {
      type: "tool.started";
      toolCallId: string;
      name: string;
      kind: ToolKind;
      summary: string;
      input: unknown;
    }
  | { type: "tool.completed"; toolCallId: string; output: string; isError: boolean }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "turn.completed"; reason: TurnEndReason; errorMessage: string | null };

export interface BackendStatus {
  available: boolean;
  detail: string;
}

export interface StartOptions {
  workingDirectory: string;
  model: string;
}

export interface ResumeOptions extends StartOptions {
  backendSessionId: string;
}

export interface BackendSession {
  readonly backendSessionId: string;
  readonly events: AsyncIterable<BackendEvent>;
  send(text: string): Promise<void>;
  interrupt(): Promise<void>;
  close(): Promise<void>;
}

export interface BackendAdapter {
  readonly id: BackendId;
  readonly displayName: string;
  status(): Promise<BackendStatus>;
  listModels(): Promise<ModelInfo[]>;
  start(options: StartOptions): Promise<BackendSession>;
  resume(options: ResumeOptions): Promise<BackendSession>;
}

export class BackendSessionNotFoundError extends Error {
  readonly backendSessionId: string;

  constructor(backendSessionId: string) {
    super(`Backend session ${backendSessionId} no longer exists`);
    this.name = "BackendSessionNotFoundError";
    this.backendSessionId = backendSessionId;
  }
}
