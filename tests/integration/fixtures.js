const path = require("node:path");
const { test: base, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..", "..");

/** Shared persistent context so the extension stays loaded across tests. */
module.exports.test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const ctx = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        "--headless=new",
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(ctx);
    await ctx.close();
  },

  extensionId: async ({ context }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) sw = await context.waitForEvent("serviceworker");
    const id = sw.url().split("/")[2];
    await use(id);
  },
});

module.exports.expect = require("@playwright/test").expect;
