import type { SessionSummary } from "../../shared/session.ts";

const statusStyles: Record<SessionSummary["status"], { color: string; label: string }> = {
  idle: { color: "bg-zinc-500", label: "Idle" },
  starting: { color: "bg-amber-400 animate-pulse", label: "Starting" },
  running: { color: "bg-sky-400 animate-pulse", label: "Running" },
  error: { color: "bg-red-500", label: "Error" },
};

export function StatusIndicator({ session }: { session: SessionSummary }) {
  const { color, label } = statusStyles[session.status];
  const processLabel =
    session.processState === "live" ? "agent process live" : "agent process released";
  return (
    <span
      role="img"
      aria-label={`${label}, ${processLabel}`}
      title={`${label} · ${processLabel}`}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color} ${
        session.processState === "released" ? "opacity-50" : ""
      }`}
    />
  );
}
