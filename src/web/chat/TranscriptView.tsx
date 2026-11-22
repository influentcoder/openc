import { useEffect, useRef } from "react";
import type { TranscriptItem } from "./transcript-state.ts";

const stickToBottomThresholdPixels = 400;

export function TranscriptView({ items }: { items: TranscriptItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || items.length === 0) {
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < stickToBottomThresholdPixels) {
      container.scrollTop = container.scrollHeight;
    }
  }, [items]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto" data-testid="transcript">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-6">
        {items.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-500">Send a message to start.</p>
        )}
        {items.map((item) => (
          <TranscriptEntry key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function TranscriptEntry({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case "user":
      return (
        <div className="self-end rounded-lg bg-zinc-800 px-4 py-2 text-sm whitespace-pre-wrap text-zinc-100">
          {item.text}
        </div>
      );
    case "assistant":
      return (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-200">
          {item.text}
          {item.streaming && <span className="ml-0.5 animate-pulse text-sky-400">▍</span>}
        </div>
      );
    case "tool":
      return <ToolCallBlock item={item} />;
    case "notice":
      return <Notice tone={item.tone} text={item.text} />;
  }
}

function ToolCallBlock({ item }: { item: Extract<TranscriptItem, { kind: "tool" }> }) {
  const state = item.output === null ? "running" : item.isError ? "failed" : "done";
  return (
    <details className="rounded-md border border-zinc-800 bg-zinc-900/60 text-sm">
      <summary className="cursor-pointer px-3 py-2 text-zinc-300">
        <span className="font-mono text-xs text-sky-300">{item.name}</span>
        <span className="ml-2 font-mono text-xs text-zinc-400">{item.summary}</span>
        <span className={`ml-2 text-xs ${state === "failed" ? "text-red-400" : "text-zinc-500"}`}>
          {state}
        </span>
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300">
        {item.output ?? "…"}
      </pre>
    </details>
  );
}

const noticeColors = { info: "text-zinc-500", warning: "text-amber-400", error: "text-red-400" };

function Notice({ tone, text }: { tone: keyof typeof noticeColors; text: string }) {
  return <p className={`text-center text-xs ${noticeColors[tone]}`}>{text}</p>;
}
