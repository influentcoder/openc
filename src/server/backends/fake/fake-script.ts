import { readdir } from "node:fs/promises";
import type { ToolKind } from "../../../shared/events.ts";

export type FakeStep =
  | { kind: "text"; chunks: string[] }
  | { kind: "tool"; name: string; toolKind: ToolKind; summary: string; output: string }
  | { kind: "failure"; message: string };

export const fakeTriggerWords = {
  tool: "tool",
  slow: "slow",
  failure: "fail",
} as const;

export async function scriptForMessage(
  text: string,
  messageNumber: number,
  workingDirectory: string,
): Promise<FakeStep[]> {
  const lowerText = text.toLowerCase();
  if (lowerText.includes(fakeTriggerWords.failure)) {
    return [{ kind: "failure", message: "Simulated backend failure" }];
  }
  const steps: FakeStep[] = [];
  if (lowerText.includes(fakeTriggerWords.tool)) {
    steps.push(await listDirectoryStep(workingDirectory));
  }
  const repetitions = lowerText.includes(fakeTriggerWords.slow) ? 50 : 1;
  const reply = `Echo #${messageNumber}: ${text}`;
  steps.push({ kind: "text", chunks: chunkWords(Array(repetitions).fill(reply).join(" ")) });
  return steps;
}

async function listDirectoryStep(workingDirectory: string): Promise<FakeStep> {
  const names = await readdir(workingDirectory);
  return {
    kind: "tool",
    name: "Bash",
    toolKind: "execute",
    summary: "ls",
    output: names.length > 0 ? names.sort().join("\n") : "(empty directory)",
  };
}

function chunkWords(text: string): string[] {
  return text.split(/(?<= )/);
}
