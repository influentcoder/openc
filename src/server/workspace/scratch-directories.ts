import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { SessionId } from "../../shared/ids.ts";

export class ScratchDirectories {
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  async create(sessionId: SessionId): Promise<string> {
    const path = this.pathFor(sessionId);
    await mkdir(path, { recursive: true });
    return path;
  }

  async remove(sessionId: SessionId): Promise<void> {
    await rm(this.pathFor(sessionId), { recursive: true, force: true });
  }

  pathFor(sessionId: SessionId): string {
    return join(this.root, sessionId);
  }
}
