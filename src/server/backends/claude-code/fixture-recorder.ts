import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const SystemMessageSchema = z.looseObject({
  type: z.literal("system"),
  subtype: z.string(),
  session_id: z.string().optional(),
  model: z.string().optional(),
});

export function scrubForFixture(message: unknown, workingDirectory: string): unknown {
  const system = SystemMessageSchema.safeParse(message);
  const kept = system.success
    ? {
        type: system.data.type,
        subtype: system.data.subtype,
        session_id: system.data.session_id,
        model: system.data.model,
      }
    : message;
  const serialized = JSON.stringify(kept)
    .replaceAll(workingDirectory, "<workdir>")
    .replaceAll(homedir(), "<home>");
  const scrubbed: unknown = JSON.parse(serialized);
  return scrubbed;
}

export class FixtureRecorder {
  private readonly filePath: string;
  private readonly workingDirectory: string;

  constructor(directory: string, sessionId: string, workingDirectory: string) {
    mkdirSync(directory, { recursive: true });
    this.filePath = join(directory, `${sessionId}.jsonl`);
    this.workingDirectory = workingDirectory;
  }

  recordPrompt(text: string): void {
    this.append({ direction: "in", text });
  }

  async *recordMessages(messages: AsyncIterable<unknown>): AsyncGenerator<unknown> {
    for await (const message of messages) {
      this.append({ direction: "out", message: scrubForFixture(message, this.workingDirectory) });
      yield message;
    }
  }

  private append(line: unknown): void {
    appendFileSync(this.filePath, `${JSON.stringify(line)}\n`);
  }
}
