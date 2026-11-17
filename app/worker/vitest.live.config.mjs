import base from "./vitest.config.mjs";
export default {
  ...base,
  test: {
    ...base.test,
    include: ["worker/tests/apple.live.mjs"],
    testTimeout: 90000,
  },
};
