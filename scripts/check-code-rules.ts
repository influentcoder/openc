import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { findViolations, type RuleViolation } from "./code-rules.ts";

const checkedRoots = ["src", "scripts", "tests"];
const excludedPathFragments = ["/db/migrations/", "/node_modules/"];
const repositoryRoot = join(import.meta.dirname, "..");

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !excludedPathFragments.some((fragment) => path.includes(fragment)));
}

async function main(): Promise<void> {
  const files = (
    await Promise.all(
      checkedRoots
        .map((root) => join(repositoryRoot, root))
        .filter((root) => existsSync(root))
        .map(listSourceFiles),
    )
  ).flat();
  const violations: RuleViolation[] = [];
  for (const file of files) {
    violations.push(
      ...findViolations(relative(repositoryRoot, file), await readFile(file, "utf8")),
    );
  }
  for (const violation of violations) {
    process.stderr.write(
      `${violation.file}:${violation.line} [${violation.rule}] ${violation.detail}\n`,
    );
  }
  process.stdout.write(`Checked ${files.length} files, ${violations.length} rule violations\n`);
  process.exitCode = violations.length > 0 ? 1 : 0;
}

await main();
