import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";

export const ServerModeSchema = z.enum(["real", "fake"]);
export type ServerMode = z.infer<typeof ServerModeSchema>;

export interface ServerConfig {
  mode: ServerMode;
  host: string;
  port: number;
  dataDirectory: string;
  browseRoot: string;
  token: string | undefined;
  webDistDirectory: string;
  logLevel: "silent" | "info" | "debug";
}

export const loopbackHost = "127.0.0.1";
export const defaultPort = 4317;

export function parseServerArguments(argumentList: string[]): ServerConfig {
  const { values } = parseArgs({
    args: argumentList,
    options: {
      fake: { type: "boolean", default: false },
      port: { type: "string", default: String(defaultPort) },
      "data-dir": { type: "string", default: join(homedir(), ".openc") },
      "browse-root": { type: "string", default: homedir() },
      token: { type: "string" },
      quiet: { type: "boolean", default: false },
    },
  });
  return {
    mode: values.fake ? "fake" : "real",
    host: loopbackHost,
    port: z.coerce.number().int().min(0).max(65535).parse(values.port),
    dataDirectory: resolve(values["data-dir"]),
    browseRoot: resolve(values["browse-root"]),
    token: values.token,
    webDistDirectory: resolve(import.meta.dirname, "../../dist/web"),
    logLevel: values.quiet ? "silent" : "info",
  };
}
