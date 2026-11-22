import { defineConfig } from "@playwright/test";

const port = 4399;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `node tests/e2e/start-fake-server.ts --port ${port}`,
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: false,
  },
});
