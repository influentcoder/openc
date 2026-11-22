import { loadOrCreateAccessToken } from "./access-token.ts";
import { browserLink } from "./browser-link.ts";
import { createExternalDependencies, createServices } from "./composition.ts";
import { parseServerArguments } from "./config.ts";
import { startServer } from "./server.ts";

const config = parseServerArguments(process.argv.slice(2));
const dependencies = await createExternalDependencies(config);
const services = createServices(dependencies);
const token = config.token ?? (await loadOrCreateAccessToken(config.dataDirectory));
const server = await startServer(services, { ...config, token });

services.logger.info({ mode: config.mode, url: server.url }, "openc is running");
const link = browserLink({ serverUrl: server.url, webUrl: config.webUrl, token });
process.stdout.write(`\nOpen ${link}\n\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close().then(
      () => process.exit(0),
      (error: unknown) => {
        services.logger.error({ error }, "Shutdown failed");
        process.exit(1);
      },
    );
  });
}
