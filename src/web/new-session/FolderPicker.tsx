import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServices } from "../app/services.tsx";

interface FolderPickerProps {
  selectedPath: string | null;
  recentDirectories: string[];
  onSelect(path: string): void;
}

export function FolderPicker({ selectedPath, recentDirectories, onSelect }: FolderPickerProps) {
  const { api } = useServices();
  const [browsedPath, setBrowsedPath] = useState<string | null>(null);
  const listing = useQuery({
    queryKey: ["directories", browsedPath],
    queryFn: () => api.listDirectory(browsedPath),
  });
  return (
    <div className="space-y-3">
      {recentDirectories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recentDirectories.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => onSelect(path)}
              className={`rounded-full border px-3 py-1 text-xs ${
                path === selectedPath
                  ? "border-sky-500 text-sky-300"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              {path.split("/").at(-1)}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-md border border-zinc-700">
        <div className="flex items-center gap-2 border-b border-zinc-700 px-3 py-2">
          <button
            type="button"
            aria-label="Parent folder"
            disabled={!listing.data?.parentPath}
            onClick={() => setBrowsedPath(listing.data?.parentPath ?? null)}
            className="text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
          >
            ↑
          </button>
          <span className="flex-1 truncate font-mono text-xs text-zinc-400">
            {listing.data?.path}
          </span>
          <button
            type="button"
            disabled={!listing.data}
            onClick={() => listing.data && onSelect(listing.data.path)}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-600"
          >
            Use this folder
          </button>
        </div>
        <ul className="max-h-56 overflow-y-auto py-1" aria-label="Folders">
          {listing.error && (
            <li className="px-3 py-2 text-xs text-red-400">{listing.error.message}</li>
          )}
          {listing.data?.entries.map((entry) => (
            <li key={entry.path}>
              <button
                type="button"
                onClick={() => setBrowsedPath(entry.path)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
              >
                <span>{entry.name}</span>
                {entry.isGitRepository && <span className="text-xs text-emerald-400">git</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="truncate text-xs text-zinc-400">
        Selected: <span className="font-mono">{selectedPath ?? "none"}</span>
      </p>
    </div>
  );
}
