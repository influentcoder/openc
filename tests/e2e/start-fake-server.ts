import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { createExternalDependencies, createServices } from "../../src/server/composition.ts";
import { parseServerArguments } from "../../src/server/config.ts";
import { startServer } from "../../src/server/server.ts";

export const e2eToken = "e2e-token";

const { values } = parseArgs({ options: { port: { type: "string", default: "4399" } } });
const root = await mkdtemp(join(tmpdir(), "openc-e2e-"));
const browseRoot = join(root, "projects");
await mkdir(join(browseRoot, "demo-project", ".git"), { recursive: true });
await mkdir(join(browseRoot, "demo-project", "src"), { recursive: true });

const config = parseServerArguments([
  "--fake",
  "--quiet",
  `--port=${values.port}`,
  `--data-dir=${join(root, "data")}`,
  `--browse-root=${browseRoot}`,
  `--token=${e2eToken}`,
]);
const services = createServices(await createExternalDependencies(config));
const server = await startServer(services, { ...config, token: e2eToken });
process.stdout.write(`e2e server ready on ${server.url}\n`);
