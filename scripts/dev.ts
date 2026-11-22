import { type ChildProcess, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadOrCreateAccessToken } from "../src/server/access-token.ts";
import { defaultPort } from "../src/server/config.ts";

const repositoryRoot = join(import.meta.dirname, "..");
const webDevelopmentUrl = "http://localhost:5173";

const { values } = parseArgs({ options: { fake: { type: "boolean", default: false } } });
const dataDirectory = values.fake ? join(repositoryRoot, ".openc-dev") : join(homedir(), ".openc");
await mkdir(dataDirectory, { recursive: true });
const token = await loadOrCreateAccessToken(dataDirectory);

const children: ChildProcess[] = [
  spawn(
    process.execPath,
    [
      "--watch",
      "src/server/main.ts",
      ...(values.fake ? ["--fake"] : []),
      `--port=${defaultPort}`,
      `--data-dir=${dataDirectory}`,
      `--token=${token}`,
      `--web-url=${webDevelopmentUrl}`,
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  ),
  spawn(join(repositoryRoot, "node_modules/.bin/vite"), [], {
    cwd: repositoryRoot,
    stdio: "inherit",
    env: { ...process.env, OPENC_SERVER_PORT: String(defaultPort) },
  }),
];

const stopAll = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
};
for (const child of children) {
  child.once("exit", stopAll);
}
process.once("SIGINT", stopAll);
process.once("SIGTERM", stopAll);
