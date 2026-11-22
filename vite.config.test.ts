import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "./vite.config.ts";

describe("development web server proxy", () => {
  it("never forwards the web source files themselves to the backend", async () => {
    const proxiedPrefixes = Object.keys(viteConfig.server?.proxy ?? {}).map((prefix) =>
      prefix.replace(/^\//, ""),
    );
    const webSourceEntries = await readdir(join(import.meta.dirname, "src/web"));
    expect(webSourceEntries.filter((entry) => proxiedPrefixes.includes(entry))).toEqual([]);
  });
});
