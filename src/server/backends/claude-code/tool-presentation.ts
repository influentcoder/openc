import { z } from "zod";
import type { ToolKind } from "../../../shared/events.ts";

const toolKinds: Record<string, ToolKind> = {
  Read: "read",
  NotebookRead: "read",
  Write: "edit",
  Edit: "edit",
  MultiEdit: "edit",
  NotebookEdit: "edit",
  Bash: "execute",
  BashOutput: "execute",
  Grep: "search",
  Glob: "search",
  LS: "search",
  WebFetch: "fetch",
  WebSearch: "fetch",
};

const summaryFields = [
  "command",
  "file_path",
  "notebook_path",
  "pattern",
  "url",
  "query",
  "description",
  "path",
  "prompt",
] as const;

const maximumSummaryLength = 120;
export const maximumToolOutputLength = 50_000;

export function toolKindOf(toolName: string): ToolKind {
  return toolKinds[toolName] ?? "other";
}

export function summarizeToolInput(toolName: string, input: unknown): string {
  const fields = z.record(z.string(), z.unknown()).safeParse(input);
  if (!fields.success) {
    return toolName;
  }
  for (const field of summaryFields) {
    const value = fields.data[field];
    if (typeof value === "string" && value.length > 0) {
      return truncate(value.split("\n")[0] ?? value, maximumSummaryLength);
    }
  }
  return toolName;
}

export function limitToolOutput(output: string): string {
  return truncate(output, maximumToolOutputLength);
}

function truncate(text: string, maximumLength: number): string {
  return text.length > maximumLength ? `${text.slice(0, maximumLength - 1)}…` : text;
}
