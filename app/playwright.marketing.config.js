import base from "./playwright.config.js";
export default {
  ...base,
  testMatch: "marketing.spec.js",
  webServer: {
    ...base.webServer,
    url: "http://127.0.0.1:4326/api/health",
    env: {
      ...base.webServer.env,
      PORT: "4326",
      PUBLIC_ORIGIN: "http://127.0.0.1:4326",
      DB_PATH: ".test-data/marketing-" + Date.now() + ".sqlite",
    },
  },
  use: { ...base.use, baseURL: "http://127.0.0.1:4326" },
};
