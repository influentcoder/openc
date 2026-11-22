import { describe, expect, it } from "vitest";
import { browserLink } from "./browser-link.ts";

describe("R-PLAT-3 printed browser link", () => {
  it("points at the server itself when no separate web URL is configured", () => {
    expect(
      browserLink({ serverUrl: "http://127.0.0.1:4317", webUrl: undefined, token: "abc" }),
    ).toBe("http://127.0.0.1:4317/?token=abc");
  });

  it("points at the web URL when the UI is served elsewhere, as in development", () => {
    expect(
      browserLink({
        serverUrl: "http://127.0.0.1:4317",
        webUrl: "http://localhost:5173",
        token: "abc",
      }),
    ).toBe("http://localhost:5173/?token=abc");
  });
});
