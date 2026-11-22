import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

export function temporaryDirectoryFactory(): () => Promise<string> {
  const created: string[] = [];
  afterEach(async () => {
    await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });
  return async () => {
    const path = await mkdtemp(join(tmpdir(), "openc-test-"));
    created.push(path);
    return path;
  };
}
