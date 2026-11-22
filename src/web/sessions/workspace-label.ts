import type { SessionSummary } from "../../shared/session.ts";

export function workspaceLabel(session: SessionSummary): string {
  if (session.workspaceMode === "scratch") {
    return "scratch";
  }
  return session.workingDirectory.split("/").filter(Boolean).at(-1) ?? session.workingDirectory;
}
