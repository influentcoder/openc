import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { ClaudeConversationOptions } from "./claude-agent-client.ts";

export const defaultModelAlias = "default";

export function buildQueryOptions(
  conversation: ClaudeConversationOptions,
  onStandardError: (data: string) => void,
): Options {
  return {
    cwd: conversation.workingDirectory,
    ...(conversation.model === defaultModelAlias ? {} : { model: conversation.model }),
    ...(conversation.resume
      ? { resume: conversation.sessionId }
      : { sessionId: conversation.sessionId }),
    includePartialMessages: true,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    settingSources: ["user", "project", "local"],
    stderr: onStandardError,
  };
}
