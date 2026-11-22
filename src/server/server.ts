import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { getRequestListener } from "@hono/node-server";
import type { Services } from "./composition.ts";
import { createApp } from "./http/create-app.ts";
import { LiveHub } from "./live/live-hub.ts";

export interface RunningServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

export interface StartServerOptions {
  host: string;
  port: number;
  token: string;
  webDistDirectory: string;
}

export async function startServer(
  services: Services,
  options: StartServerOptions,
): Promise<RunningServer> {
  const app = createApp(services, options);
  const liveHub = new LiveHub(services, options.token);
  const server = createServer(getRequestListener(app.fetch));
  server.on("upgrade", (request, socket, head) => liveHub.handleUpgrade(request, socket, head));
  const port = await listen(server, options.host, options.port);
  return {
    url: `http://${options.host}:${port}`,
    port,
    async close() {
      await liveHub.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await services.close();
    },
  };
}

function listen(server: Server, host: string, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address: AddressInfo | string | null = server.address();
      resolve(typeof address === "object" && address ? address.port : port);
    });
  });
}
