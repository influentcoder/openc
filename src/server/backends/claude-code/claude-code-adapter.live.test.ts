import { randomIdGenerator } from "../../platform/id-generator.ts";
import { createLogger } from "../../platform/logger.ts";
import { temporaryDirectoryFactory } from "../../testing/temporary-directory.ts";
import { describeBackendAdapterContract } from "../backend-adapter.contract.ts";
import { ClaudeCodeAdapter } from "./claude-code-adapter.ts";
import { SdkClaudeAgentClient } from "./sdk-claude-agent-client.ts";

const createTemporaryDirectory = temporaryDirectoryFactory();
const logger = createLogger("silent");

describeBackendAdapterContract("ClaudeCodeAdapter against the real Claude Code", async () => ({
  adapter: new ClaudeCodeAdapter({
    client: new SdkClaudeAgentClient({
      logger,
      recordingDirectory: process.env.OPENC_RECORD_CLAUDE_FIXTURES,
    }),
    ids: randomIdGenerator,
    logger,
  }),
  workingDirectory: await createTemporaryDirectory(),
  model: process.env.OPENC_LIVE_CLAUDE_MODEL ?? "haiku",
  shortPrompt: "Reply with the single word: pong",
  longRunningPrompt: "Count from 1 to 300, one number per line, with no other text.",
}));
