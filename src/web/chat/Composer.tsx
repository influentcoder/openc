import { type FormEvent, type KeyboardEvent, useState } from "react";

interface ComposerProps {
  busy: boolean;
  onSend(text: string): Promise<void>;
  onInterrupt(): Promise<void>;
}

export function Composer({ busy, onSend, onInterrupt }: ComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (busy || trimmed.length === 0) {
      return;
    }
    setError(null);
    try {
      await onSend(trimmed);
      setText("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form onSubmit={onSubmit} className="border-t border-zinc-800 p-4">
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          aria-label="Message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder={busy ? "The agent is working…" : "Message the agent (Enter to send)"}
          className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => void onInterrupt()}
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={text.trim().length === 0}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            Send
          </button>
        )}
      </div>
    </form>
  );
}
