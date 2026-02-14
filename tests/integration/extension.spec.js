const { test, expect } = require("./fixtures");

test("full overlay flow: consent → generate → open inbox → trash", async ({
  context,
  extensionId,
}) => {
  // 1. Accept data-consent
  const consentPage = await context.newPage();
  await consentPage.goto(
    `chrome-extension://${extensionId}/consent/consent.html`
  );
  await consentPage.click("#accept-btn");
  await consentPage.waitForSelector("#status.success");
  await consentPage.close();

  // 2. Navigate to the test page with an email input
  const page = await context.newPage();
  await page.goto("http://localhost:3193");

  // 3. Wait for the content script to attach the overlay host
  const host = await page.waitForSelector(".tempy-overlay-host", {
    timeout: 10_000,
  });

  // 4. Click the logo button (first and only button in closed shadow DOM)
  let box = await host.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box.x + 14, box.y + 14);

  // 5. Email input should now contain a @tempy.email address
  await expect(page.locator("#email")).toHaveValue(/tempy\.email$/, {
    timeout: 15_000,
  });
  const firstEmail = await page.locator("#email").inputValue();

  // 6. After generation, overlay swaps to two buttons — host should widen
  //    Give the DOM a moment to re-render the new buttons
  await page.waitForTimeout(500);
  box = await host.boundingBox();
  expect(box.width).toBeGreaterThan(40); // was 28px, now ~58px

  // 7. Click the "open inbox" button (right button, index 1)
  const newPagePromise = context.waitForEvent("page");
  await page.mouse.click(box.x + box.width - 14, box.y + 14);
  const inboxPage = await newPagePromise;
  await inboxPage.waitForLoadState("domcontentloaded");

  // 8. Verify the inbox URL contains the generated email
  expect(inboxPage.url()).toContain("tempy.email");
  expect(inboxPage.url()).toContain(firstEmail.split("@")[0]);
  await inboxPage.close();

  // 9. Click the "trash" button (left button, index 0) to generate a new email
  box = await host.boundingBox();
  await page.mouse.click(box.x + 14, box.y + 14);

  // 10. A new, different email should be filled
  await expect(page.locator("#email")).not.toHaveValue(firstEmail, {
    timeout: 15_000,
  });
  const secondEmail = await page.locator("#email").inputValue();
  expect(secondEmail).toMatch(/tempy\.email$/);
  expect(secondEmail).not.toBe(firstEmail);
});
