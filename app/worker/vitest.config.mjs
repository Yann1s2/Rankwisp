import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: { configPath: "./worker/wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./worker/migrations"),
          NODE_ENV: "test",
          PUBLIC_ORIGIN: "https://rankwisp.pages.dev",
          GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
          GOOGLE_CLIENT_SECRET: "test-only-secret",
          GOOGLE_REDIRECT_URI:
            "https://rankwisp.pages.dev/api/auth/google/callback",
        },
      },
    })),
  ],
  test: {
    include: ["worker/tests/**/*.test.mjs"],
    setupFiles: ["./worker/tests/setup.mjs"],
    testTimeout: 30000,
  },
});
