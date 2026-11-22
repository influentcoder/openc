import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "./vite.config.ts";

const proxyKeys = Object.keys(viteConfig.server?.proxy ?? {});

function isProxied(url: string): boolean {
  return proxyKeys.some((key) =>
    key.startsWith("^") ? new RegExp(key).test(url) : url.startsWith(key),
  );
}

describe("development web server proxy", () => {
  it("forwards API calls and the live connection to the backend", () => {
    expect(isProxied("/api/sessions")).toBe(true);
    expect(isProxied("/api/sessions/abc/messages")).toBe(true);
    expect(isProxied("/ws?token=abc")).toBe(true);
  });

  it("never forwards web source files, even ones whose names start like a proxied path", async () => {
    const webSourceEntries = await readdir(join(import.meta.dirname, "src/web"));
    const lookalikes = ["api-helpers.ts", "apiary/index.ts", "ws-client.ts", "wsl.ts"];
    const proxiedSources = [...webSourceEntries, ...lookalikes].filter((entry) =>
      isProxied(`/${entry}`),
    );
    expect(proxiedSources).toEqual([]);
  });
});
