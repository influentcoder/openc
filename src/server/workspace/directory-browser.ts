import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DirectoryEntry, DirectoryListing } from "../../shared/api.ts";
import { PathNotFoundError, resolveWithinRoot } from "./path-guard.ts";

export class DirectoryBrowser {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async list(requestedPath: string | undefined): Promise<DirectoryListing> {
    const path = await resolveWithinRoot(this.root, requestedPath ?? this.root);
    const realRoot = await resolveWithinRoot(this.root, this.root);
    const children = await readdir(path, { withFileTypes: true });
    const entries = await Promise.all(
      children.filter(isVisibleDirectory).map((child) => describeEntry(join(path, child.name))),
    );
    return {
      path,
      parentPath: path === realRoot ? null : dirname(path),
      entries: entries.sort((first, second) => first.name.localeCompare(second.name)),
    };
  }

  async resolveWorkingDirectory(requestedPath: string): Promise<string> {
    const path = await resolveWithinRoot(this.root, requestedPath);
    if (!(await stat(path)).isDirectory()) {
      throw new PathNotFoundError(requestedPath);
    }
    return path;
  }
}

function isVisibleDirectory(entry: Dirent): boolean {
  return entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules";
}

async function describeEntry(path: string): Promise<DirectoryEntry> {
  return {
    name: path.split("/").at(-1) ?? path,
    path,
    isGitRepository: await isGitRepository(path),
  };
}

async function isGitRepository(path: string): Promise<boolean> {
  try {
    await stat(join(path, ".git"));
    return true;
  } catch {
    return false;
  }
}
