import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["src/server/**/*.test.ts", "src/shared/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["**/*.live.test.ts"],
        },
      },
      {
        test: {
          name: "live",
          environment: "node",
          include: ["src/server/**/*.live.test.ts"],
          testTimeout: 120_000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          include: ["src/web/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
