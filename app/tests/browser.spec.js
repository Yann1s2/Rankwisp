import { test, expect } from "@playwright/test";
const base = "http://127.0.0.1:4320";
test.use({ baseURL: base });
test("marketing EN/DE, navigation and responsive layout", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/en/");
  await expect(
    page.getByRole("heading", {
      name: "Your app has potential. Make it visible.",
    }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex,nofollow",
  );
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Deine App hat Potenzial. Mach es sichtbar.",
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Navigation umschalten" }).click();
  await expect(
    page.getByRole("link", { name: "So funktioniert’s", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../screenshots/website-mobile-de.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("demo navigation, real chart log, keyboard and reduced motion", async ({
  page,
}) => {
  await page.goto("/app?demo=1");
  await expect(
    page.getByRole("heading", { name: "Your app, at a glance." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rank history", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Measurement log", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspect", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  expect(
    await page
      .locator(".metric")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.001);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "One purchase. Yours to keep." }),
  ).toBeVisible();
});
test("real backend registration, import, archive, export, AI fallback and sign out", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await page
    .getByRole("button", { name: "New here? Start your free trial" })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-" + Date.now() + "@example.test");
  await page
    .getByLabel("Password", { exact: false })
    .fill("a safe testing password");
  await page.getByRole("button", { name: "Start my 24 days" }).click();
  await expect(
    page.getByRole("heading", { name: "Meet your next chapter." }),
  ).toBeVisible();
  const workspace = {
    schemaVersion: 1,
    automaticUpdates: false,
    projects: [
      {
        id: "fixture-project",
        appleID: 123456789,
        name: "QA fixture",
        country: "ch",
        archived: false,
        keywords: [
          {
            id: "fixture-keyword",
            text: "synthetic qa phrase",
            category: "core",
            archived: false,
            samples: [
              {
                id: "fixture-sample",
                date: new Date().toISOString(),
                rank: 2,
                resultCount: 2,
                results: [
                  { id: 987654321, name: "Other fixture" },
                  { id: 123456789, name: "QA fixture" },
                ],
                source: "synthetic-test",
              },
            ],
          },
        ],
      },
    ],
  };
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "synthetic-fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(workspace)),
    });
  await expect(
    page.getByRole("heading", { name: "Review your import" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import & keep recovery copy" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your app, at a glance." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keywords", exact: true }).click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByLabel("Archived", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "synthetic qa phrase" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Next moves", exact: true }).click();
  await page.getByRole("button", { name: "Find a useful next step" }).click();
  await expect(
    page.getByText("AI is off until you choose to share this data."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Your data", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export everything" }).click();
  expect((await download).suggestedFilename()).toBe("rankwisp-export.json");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("onboarding state machine with injected Apple fixtures", async ({
  page,
}) => {
  await page.route("**/api/search?*", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: 123456789,
            name: "Synthetic planner",
            developer: "QA fixture",
            genre: "Productivity",
          },
        ],
      },
    }),
  );
  await page.route("**/api/competitors?*", (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: 987654321,
            name: "Synthetic rival",
            genre: "Productivity",
            reason: { sameCategory: true, query: "planner" },
          },
        ],
      },
    }),
  );
  await page.route("**/api/projects", (route) =>
    route.fulfill({ json: { id: "created-qa" } }),
  );
  await page.goto("/app");
  await page.getByRole("button", { name: "Continue with email", exact: true }).click();
  await page
    .getByRole("button", { name: "New here? Start your free trial" })
    .click();
  await page
    .getByLabel("Email", { exact: true })
    .fill("onboard-" + Date.now() + "@example.test");
  await page
    .getByLabel("Password", { exact: false })
    .fill("a safe testing password");
  await page.getByRole("button", { name: "Start my 24 days" }).click();
  await page.getByRole("button", { name: "Find my app" }).click();
  await page.getByRole("textbox", { name: "Find app" }).fill("planner");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Find suggestions" }).click();
  await page
    .getByRole("button", {
      name: "Synthetic rival Same category · Productivity",
    })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What should we watch?" }),
  ).toBeVisible();
  await page.getByLabel("Your first keywords").fill("planner, morning routine");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Synthetic rival Same category · Productivity",
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Google-only configuration and cancelled login work without modern AbortSignal statics", async ({ page }) => {
  await page.addInitScript(() => { AbortSignal.timeout = undefined; AbortSignal.any = undefined; });
  await page.route("**/api/config", route => route.fulfill({json:{authProvider:"google",googleConfigured:false}}));
  await page.goto("/app?authError=GOOGLE_CANCELLED");
  await expect(page.getByRole("button", {name:"Continue with Google",exact:true})).toBeVisible();
  await expect(page.getByRole("button", {name:"Continue with email",exact:true})).toHaveCount(0);
  await expect(page.getByText("Google sign-in is temporarily unavailable. Please try again later or contact support.")).toBeVisible();
  await expect(page).not.toHaveURL(/authError/);
  expect(await page.locator("body").innerText()).not.toContain("The server is unavailable");
});

test("all app views fit phone, landscape, tablet and short desktop without page overflow", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/app?demo=1");
  const views=["Overview","Keywords","Rank history","Competitors","Next moves","Settings"];
  for (const [width,height] of [[375,667],[390,844],[844,390],[768,1024],[1440,800]]) {
    await page.setViewportSize({width,height});
    for(const name of views) {
      await test.step(`${width}×${height}: ${name}`, async () => {
      const button=page.getByRole("button",{name,exact:true});
      if (!(await button.isVisible())) await page.getByRole("button",{name:"Open navigation"}).click();
      await button.click();
      await expect.poll(()=>page.evaluate(()=>({x:document.documentElement.scrollWidth<=innerWidth,y:document.documentElement.scrollHeight<=innerHeight}))).toEqual({x:true,y:true});
      await page.mouse.wheel(1000,1000);
      expect(await page.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual({x:0,y:0});
      });
    }
  }
  await page.getByRole("tab",{name:"Plan & usage",exact:true}).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab",{name:"Preferences",exact:true})).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("End");
  await expect(page.getByRole("tab",{name:"Account",exact:true})).toHaveAttribute("aria-selected","true");
});

test("primary website, authentication and app views pass serious accessibility checks", async ({page}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const {default:AxeBuilder}=await import("@axe-core/playwright");
  const results=[];
  for(const route of ["/en/","/app","/app?demo=1"]) {
    await page.goto(route);
    if(route.includes("demo")) await expect(page.getByRole("heading",{name:"Your app, at a glance."})).toBeVisible();
    else if(route==="/app") await expect(page.getByRole("button",{name:"Continue with Google",exact:true})).toBeVisible();
    const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    results.push(...audit.violations.filter(v=>["critical","serious"].includes(v.impact)).map(v=>({route,id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
  }
  expect(results).toEqual([]);
});
