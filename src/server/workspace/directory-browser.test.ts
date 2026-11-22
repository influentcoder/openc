import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { temporaryDirectoryFactory } from "../testing/temporary-directory.ts";
import { DirectoryBrowser } from "./directory-browser.ts";
import { PathNotFoundError, PathOutsideRootError } from "./path-guard.ts";

const createTemporaryDirectory = temporaryDirectoryFactory();

async function createBrowserWithProjects() {
  const root = await createTemporaryDirectory();
  await mkdir(join(root, "beta", ".git"), { recursive: true });
  await mkdir(join(root, "alpha"));
  await mkdir(join(root, ".hidden"));
  return { root, browser: new DirectoryBrowser(root) };
}

describe("R-SES-2 folder picker directory browser", () => {
  it("lists visible sub-directories sorted by name and flags git repositories", async () => {
    const { root, browser } = await createBrowserWithProjects();
    const listing = await browser.list(undefined);
    expect(listing.parentPath).toBeNull();
    expect(listing.entries).toEqual([
      { name: "alpha", path: join(root, "alpha"), isGitRepository: false },
      { name: "beta", path: join(root, "beta"), isGitRepository: true },
    ]);
  });

  it("gives the parent of nested directories", async () => {
    const { root, browser } = await createBrowserWithProjects();
    expect((await browser.list(join(root, "alpha"))).parentPath).toBe(root);
  });

  it("refuses paths outside the allowed root", async () => {
    const { root, browser } = await createBrowserWithProjects();
    await expect(browser.list(join(root, ".."))).rejects.toBeInstanceOf(PathOutsideRootError);
  });

  it("reports missing directories", async () => {
    const { root, browser } = await createBrowserWithProjects();
    await expect(browser.resolveWorkingDirectory(join(root, "missing"))).rejects.toBeInstanceOf(
      PathNotFoundError,
    );
  });
});
