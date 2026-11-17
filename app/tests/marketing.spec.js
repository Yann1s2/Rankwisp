import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const device of [
  {
    name: "Mac",
    platform: "MacIntel",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    expected: "mac",
    asset: "mac-arm64.zip",
    touch: 0,
  },
  {
    name: "Windows",
    platform: "Win32",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    expected: "windows",
    asset: "win.zip",
    touch: 0,
  },
  {
    name: "Android",
    platform: "Linux armv8l",
    ua: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36",
    expected: "mobile",
    touch: 5,
  },
  {
    name: "iPad desktop mode",
    platform: "MacIntel",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
    expected: "mobile",
    touch: 5,
  },
  {
    name: "Linux",
    platform: "Linux x86_64",
    ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
    expected: "other",
    touch: 0,
  },
]) {
  test(`${device.name}: relevant recommendation with both real downloads accessible`, async ({
    page,
  }) => {
    await page.addInitScript((device) => {
      Object.defineProperty(navigator, "platform", {
        get: () => device.platform,
      });
      Object.defineProperty(navigator, "userAgent", { get: () => device.ua });
      Object.defineProperty(navigator, "userAgentData", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "maxTouchPoints", {
        get: () => device.touch,
      });
    }, device);
    await page.goto("/en/downloads/");
    await expect(page.locator(".download-choices")).toHaveAttribute(
      "data-platform",
      device.expected,
    );
    await expect(page.locator(".download-button")).toHaveCount(2);
    for (const link of await page.locator(".download-button").all())
      await expect(link).toBeVisible();
    if (device.asset)
      await expect(
        page.locator(".download-button.recommended"),
      ).toHaveAttribute(
        "href",
        new RegExp(device.asset.replaceAll(".", "\\.") + "$"),
      );
    else
      await expect(page.locator(".download-button.recommended")).toHaveCount(0);
    await expect(page.locator(".download-preview-note")).toContainText(
      "Unsigned development previews",
    );
    await expect(
      page.getByText("No Intel Mac build is included.", { exact: false }),
    ).toBeVisible();
    await page.locator(".developer-downloads summary").click();
    await expect(
      page.getByRole("link", { name: "Download simulator build" }),
    ).toHaveAttribute("href", /Rankwisp-0\.2\.0-ios-simulator\.zip$/);
  });
}

test("website routes fit mobile and desktop, retain login and remember an explicit language", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of ["/en/", "/de/", "/en/downloads/", "/de/downloads/"]) {
    await page.goto(route);
    for (const width of [375, 390, 768, 1440]) {
      await test.step(`${route} at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        await expect(page.locator(".site-login")).toBeVisible();
        await expect(page.locator(".download-button")).toHaveCount(2);
      });
    }
  }
  await page.goto("/en/");
  await expect(page.locator(".product-shot img")).toBeVisible();
  await expect(page.locator(".product-shot figcaption")).toContainText(
    "Fictional demo data",
  );
  expect(
    await page
      .locator(".product-shot img")
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  expect(
    await page
      .locator(".brand-presence > img")
      .evaluate((img) => getComputedStyle(img).animationName),
  ).toBe("none");
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/de\/?$/);
  expect(
    await page.evaluate(() => localStorage.getItem("rankwisp-language")),
  ).toBe("de");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Navigation umschalten" }).click();
  await expect(
    page.getByRole("link", { name: "Downloads", exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Navigation umschalten" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(errors).toEqual([]);
});

test("public landing and download pages have no serious accessibility violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/en/", "/de/", "/en/downloads/", "/de/downloads/"]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      report.violations
        .filter((v) => ["critical", "serious"].includes(v.impact))
        .map((v) => ({
          route,
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
    ).toEqual([]);
  }
});
