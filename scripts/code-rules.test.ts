import { describe, expect, it } from "vitest";
import { findViolations, maximumFileLines } from "./code-rules.ts";

const rulesIn = (source: string, file = "example.ts") =>
  findViolations(file, source).map((violation) => violation.rule);

describe("code rules", () => {
  it("flags files longer than the maximum", () => {
    expect(rulesIn("const a = 1;\n".repeat(maximumFileLines + 1))).toEqual(["file-too-long"]);
    expect(rulesIn("const a = 1;\n".repeat(maximumFileLines))).toEqual([]);
  });

  it("flags comments but allows linked workarounds and triple-slash references", () => {
    expect(rulesIn("// explains what\nconst a = 1;\n")).toEqual(["comment"]);
    expect(rulesIn("const a = 1; /* trailing */\n")).toEqual(["comment"]);
    expect(rulesIn("// Workaround for https://github.com/x/y/issues/1\nconst a = 1;\n")).toEqual(
      [],
    );
    expect(rulesIn('/// <reference types="vite/client" />\nexport {};\n')).toEqual([]);
  });

  it("does not mistake URLs in strings or JSX text for comments", () => {
    expect(rulesIn('const url = "https://example.com";\n')).toEqual([]);
    expect(rulesIn("const element = <p>see https://example.com</p>;\n", "view.tsx")).toEqual([]);
  });

  it("flags type assertions except as const", () => {
    expect(rulesIn("const a = value as string;\n")).toEqual(["type-assertion"]);
    expect(rulesIn("const a = <string>value;\n")).toEqual(["type-assertion"]);
    expect(rulesIn('const a = ["x"] as const;\n')).toEqual([]);
  });
});
