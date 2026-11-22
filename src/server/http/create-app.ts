import { existsSync } from "node:fs";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { Services } from "../composition.ts";
import { bearerToken, isLoopbackHost, tokensMatch } from "./access-guard.ts";
import { respondToError } from "./error-responses.ts";
import { sessionRoutes } from "./session-routes.ts";

export interface AppOptions {
  token: string;
  webDistDirectory: string;
}

export function createApp(services: Services, options: AppOptions): Hono {
  const app = new Hono();
  app.onError((error, context) => respondToError(error, context, services.logger));
  app.use(async (context, next) => {
    if (!isLoopbackHost(context.req.header("host"))) {
      return context.json({ error: "Only loopback hosts are allowed" }, 403);
    }
    return next();
  });
  app.get("/health", (context) => context.json({ status: "ok" }));
  app.use("/api/*", async (context, next) => {
    if (!tokensMatch(options.token, bearerToken(context.req.header("authorization")))) {
      return context.json({ error: "Missing or invalid access token" }, 401);
    }
    return next();
  });
  app.route("/api/sessions", sessionRoutes(services.sessions));
  app.get("/api/backends", async (context) => context.json(await services.backends.describeAll()));
  app.get("/api/directories", async (context) =>
    context.json(await services.directoryBrowser.list(context.req.query("path"))),
  );
  app.get("/api/new-session-defaults", (context) =>
    context.json(services.newSessionDefaults.current()),
  );
  app.all("/api/*", (context) => context.json({ error: "Not found" }, 404));
  if (existsSync(options.webDistDirectory)) {
    app.use("/*", serveStatic({ root: options.webDistDirectory }));
    app.get("/*", serveStatic({ root: options.webDistDirectory, path: "index.html" }));
  }
  return app;
}
