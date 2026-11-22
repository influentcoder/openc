import { describe, expect, it } from "vitest";
import { parseServerArguments } from "./config.ts";

describe("R-PLAT-3 server arguments", () => {
  it("has no separate web URL by default", () => {
    expect(parseServerArguments([]).webUrl).toBeUndefined();
  });

  it("reads the web URL the browser should open", () => {
    expect(parseServerArguments(["--web-url=http://localhost:5173"]).webUrl).toBe(
      "http://localhost:5173",
    );
  });

  it("rejects a web URL that is not a URL", () => {
    expect(() => parseServerArguments(["--web-url=localhost"])).toThrow();
  });
});
