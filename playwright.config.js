const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/integration",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["junit", { outputFile: "integration-results.xml" }]]
    : [["list"]],
  webServer: {
    command: "node tests/integration/serve-fixture.js",
    port: 3193,
    reuseExistingServer: !process.env.CI,
  },
});
