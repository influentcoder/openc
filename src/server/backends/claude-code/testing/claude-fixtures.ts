import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const claudeFixtureDirectory = join(
  import.meta.dirname,
  "../../../../../fixtures/claude-code",
);

export const FixtureLineSchema = z.discriminatedUnion("direction", [
  z.object({ direction: z.literal("in"), text: z.string() }),
  z.object({ direction: z.literal("out"), message: z.unknown() }),
]);
export type FixtureLine = z.infer<typeof FixtureLineSchema>;

export interface FixtureTurn {
  prompt: string;
  messages: unknown[];
}

export function loadClaudeFixture(name: string): FixtureLine[] {
  return readFileSync(join(claudeFixtureDirectory, `${name}.jsonl`), "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => FixtureLineSchema.parse(JSON.parse(line)));
}

export function fixtureTurns(lines: FixtureLine[]): FixtureTurn[] {
  const turns: FixtureTurn[] = [];
  for (const line of lines) {
    if (line.direction === "in") {
      turns.push({ prompt: line.text, messages: [] });
    } else {
      const current = turns.at(-1);
      if (!current) {
        throw new Error("Fixture output appears before any prompt");
      }
      current.messages.push(line.message);
    }
  }
  return turns;
}
