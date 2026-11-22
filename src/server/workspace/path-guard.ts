import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export class PathOutsideRootError extends Error {
  constructor(path: string) {
    super(`Path is outside the allowed root: ${path}`);
    this.name = "PathOutsideRootError";
  }
}

export class PathNotFoundError extends Error {
  constructor(path: string) {
    super(`Directory does not exist: ${path}`);
    this.name = "PathNotFoundError";
  }
}

export async function resolveWithinRoot(root: string, requestedPath: string): Promise<string> {
  const realRoot = await realpath(root);
  const candidate = await realpathOrThrow(resolve(realRoot, requestedPath));
  const pathFromRoot = relative(realRoot, candidate);
  if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
    throw new PathOutsideRootError(requestedPath);
  }
  return candidate;
}

async function realpathOrThrow(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new PathNotFoundError(path);
    }
    throw error;
  }
}
