import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "browser.spec.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: "list",
  webServer: {
    command: "node server/index.mjs",
    url: "http://127.0.0.1:4320/api/health",
    reuseExistingServer: false,
    env: {
      PORT: "4320",
      PUBLIC_ORIGIN: "http://127.0.0.1:4320",
      DB_PATH: ".test-data/browser-test-" + Date.now() + ".sqlite",
      NODE_ENV: "development",
    },
  },
  use: {
    viewport: { width: 1440, height: 1100 },
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
  },
});
