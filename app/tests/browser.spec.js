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
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Open source · MIT", exact: true }),
  ).toHaveAttribute("href", "https://github.com/Yann1s2/Rankwisp");
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
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
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
  await expect(page.getByRole("heading", { name: "First, find your app." })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
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
  await page.locator("input[type=file]").setInputFiles({
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
  const suggestionFixture = await keywordSuggestionFixture(page, {
    empty: true,
  });
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
  await page
    .getByRole("button", { name: "Keyword suggestions", exact: true })
    .click();
  await page
    .getByLabel("Allow app metadata and keywords", { exact: false })
    .check();
  await page
    .getByRole("button", { name: "Suggest keywords", exact: true })
    .click();
  await page.getByLabel("Suggestion 1", { exact: true }).fill("daily planning");
  await page
    .getByRole("button", { name: "Use selected", exact: false })
    .click();
  await expect(page.getByLabel("Your first keywords")).toHaveValue(
    "planner, morning routine\ndaily planning\nweekly planning\ngentle routine",
  );
  expect(suggestionFixture.requests[0].body.appleID).toBe(123456789);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Synthetic rival Same category · Productivity",
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Google-only configuration and cancelled login work without modern AbortSignal statics", async ({
  page,
}) => {
  await page.addInitScript(() => {
    AbortSignal.timeout = undefined;
    AbortSignal.any = undefined;
  });
  await page.route("**/api/config", (route) =>
    route.fulfill({
      json: { authProvider: "google", googleConfigured: false },
    }),
  );
  await page.goto("/app?authError=GOOGLE_CANCELLED");
  await expect(
    page.getByRole("button", { name: "Continue with Google", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with email", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      "Google sign-in has not been enabled for this service yet. Contact support for access.",
    ),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/authError/);
  expect(await page.locator("body").innerText()).not.toContain(
    "The server is unavailable",
  );
});

test("all app views fit phone, landscape, tablet and short desktop without page overflow", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/app?demo=1");
  const views = [
    "Overview",
    "Keywords",
    "Rank history",
    "Competitors",
    "Next moves",
    "Settings",
  ];
  for (const [width, height] of [
    [375, 667],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1440, 800],
  ]) {
    await page.setViewportSize({ width, height });
    for (const name of views) {
      await test.step(`${width}×${height}: ${name}`, async () => {
        const button = page.getByRole("button", { name, exact: true });
        if (!(await button.isVisible()))
          await page.getByRole("button", { name: "Open navigation" }).click();
        await button.click();
        await expect
          .poll(() =>
            page.evaluate(() => ({
              x: document.documentElement.scrollWidth <= innerWidth,
              y: document.documentElement.scrollHeight <= innerHeight,
            })),
          )
          .toEqual({ x: true, y: true });
        await page.mouse.wheel(1000, 1000);
        expect(await page.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual(
          { x: 0, y: 0 },
        );
      });
    }
  }
  await page.getByRole("tab", { name: "Plan & usage", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Preferences", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Account", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("primary website, authentication and app views pass serious accessibility checks", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const results = [];
  for (const route of ["/en/", "/app", "/app?demo=1"]) {
    await page.goto(route);
    if (route.includes("demo"))
      await expect(
        page.getByRole("heading", { name: "Your app, at a glance." }),
      ).toBeVisible();
    else if (route === "/app")
      await expect(
        page.getByRole("button", { name: "Continue with Google", exact: true }),
      ).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push(
      ...audit.violations
        .filter((v) => ["critical", "serious"].includes(v.impact))
        .map((v) => ({
          route,
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
    );
  }
  expect(results).toEqual([]);
});

async function keywordSuggestionFixture(
  page,
  { configured = true, response, empty = false } = {},
) {
  const { demoWorkspace } = await import("../src/demo.mjs");
  const workspace = demoWorkspace();
  if (empty) workspace.projects = [];
  let consent = false;
  const requests = [],
    additions = [];
  await page.route("**/api/config", (route) =>
    route.fulfill({ json: { aiConfigured: configured } }),
  );
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        account: { id: "suggestion-fixture", email: "fixture@example.test" },
        license: {
          state: "trial",
          daysRemaining: 24,
          checksRemaining: 120,
          aiRemaining: 8,
        },
        aiConsent: consent,
      },
    }),
  );
  await page.route("**/api/workspace", (route) =>
    route.fulfill({ json: { workspace, revision: "fixture" } }),
  );
  await page.route("**/api/preferences", (route) => {
    consent = route.request().postDataJSON().aiConsent;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/keyword-suggestions", (route) => {
    requests.push({ body: route.request().postDataJSON(), consent });
    return route.fulfill({
      json: response || {
        mode: "ai",
        model: "gpt-6-luna",
        cached: false,
        suggestions: [
          {
            keyword: "daily planner",
            reason: "Existing keyword, should be filtered",
          },
          {
            keyword: "weekly planning",
            reason: "Matches the public planning description",
          },
          {
            keyword: "gentle routine",
            reason: "A focused alternative to review",
          },
        ],
      },
    });
  });
  await page.route("**/api/projects/demo/keywords", (route) => {
    additions.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  return { requests, additions };
}

test("keyword ideas require consent, remain editable drafts and save only on explicit confirmation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await keywordSuggestionFixture(page);
  await page.goto("/app/");
  await page.getByRole("button", { name: "Keywords", exact: true }).click();
  await page
    .getByRole("button", { name: "Suggest keywords", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const generate = dialog.getByRole("button", {
    name: "Suggest keywords",
    exact: true,
  });
  await expect(generate).toBeDisabled();
  await dialog
    .getByLabel("Allow app metadata and keywords", { exact: false })
    .check();
  await generate.click();
  await expect(dialog.getByLabel("Suggestion 1", { exact: true })).toHaveValue(
    "weekly planning",
  );
  expect(fixture.requests[0].consent).toBe(true);
  expect(fixture.requests[0].body).toMatchObject({
    appleID: 100000001,
    country: "us",
    locale: "en",
  });
  expect(fixture.requests[0].body.existingKeywords).toContain("daily planner");
  await dialog
    .getByLabel("Suggestion 1", { exact: true })
    .fill("focused planning");
  await dialog.getByLabel("Select suggestion 2", { exact: true }).uncheck();
  const draft = dialog.getByLabel("What might someone search for?", {
    exact: false,
  });
  await draft.fill("My own wording\nweekly review");
  await page.screenshot({
    path: "../screenshots/keyword-suggestions-desktop.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 375, height: 667 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "../screenshots/keyword-suggestions-mobile.png",
    animations: "disabled",
  });
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const audit = await new AxeBuilder({ page })
    .include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    audit.violations
      .filter((v) => ["critical", "serious"].includes(v.impact))
      .map((v) => v.id),
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Use selected", exact: false })
    .click();
  await expect(draft).toHaveValue(
    "My own wording\nweekly review\nfocused planning",
  );
  expect(fixture.additions).toEqual([]);
  await dialog.getByLabel("Suggestion 1", {exact:true}).fill("Ｍｙ　ｏｗｎ　ｗｏｒｄｉｎｇ");
  await dialog.getByLabel("Select suggestion 1", {exact:true}).check();
  await dialog.getByRole("button", {name:"Use selected",exact:false}).click();
  await expect(draft).toHaveValue("My own wording\nweekly review\nfocused planning");
  await dialog
    .getByRole("button", { name: "Add keywords", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(fixture.additions).toEqual([
    { text: "My own wording\nweekly review\nfocused planning" },
  ]);
});

test("keyword suggestions unavailable never block or replace manual input", async ({
  page,
}) => {
  const fixture = await keywordSuggestionFixture(page, { configured: false });
  await page.goto("/app/");
  await page.getByRole("button", { name: "Keywords", exact: true }).click();
  await page
    .getByRole("button", { name: "Suggest keywords", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(
      "AI suggestions are not available yet. You can enter keywords manually.",
    ),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Suggest keywords", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("What might someone search for?", { exact: false })
    .fill("manual keyword");
  await dialog
    .getByRole("button", { name: "Add keywords", exact: true })
    .click();
  expect(fixture.requests).toEqual([]);
  expect(fixture.additions).toEqual([{ text: "manual keyword" }]);
});

test("keyword service failures preserve the reviewed manual draft", async ({
  page,
}) => {
  await keywordSuggestionFixture(page, {
    response: {
      mode: "unavailable",
      suggestions: [],
      reason: "AI_UNAVAILABLE",
    },
  });
  await page.goto("/app/");
  await page.getByRole("button", { name: "Keywords", exact: true }).click();
  await page
    .getByRole("button", { name: "Suggest keywords", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const draft = dialog.getByLabel("What might someone search for?", {
    exact: false,
  });
  await draft.fill("keep this wording");
  await dialog
    .getByLabel("Allow app metadata and keywords", { exact: false })
    .check();
  await dialog
    .getByRole("button", { name: "Suggest keywords", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Suggestions are temporarily unavailable",
  );
  await expect(draft).toHaveValue("keep this wording");
  await expect(
    dialog.getByRole("button", { name: "Add keywords", exact: true }),
  ).toBeEnabled();
});

test("keyword standings retain absolute ranks and keep comparison details accessible", async ({ page }) => {
  await page.goto("/app?demo=1");
  await page.getByRole("button", {name: "Competitors", exact: true}).click();
  const standings = page.locator(".keyword-standings");
  const own = standings.locator("li.is-own");
  await expect(own.locator(".keyword-standings-rank")).toContainText("#8");
  await expect(standings.locator("li").filter({hasText:"Daily Ritual"}).locator(".keyword-standings-rank")).toContainText("#1");
  await expect(standings.locator("li").filter({hasText:"Small Steps"}).locator(".keyword-standings-rank")).toContainText("#9");
  await page.getByLabel("Ranking keyword").selectOption("demo-1");
  await expect(own.locator(".keyword-standings-rank")).toContainText("#6");
  await expect(standings.locator("li").filter({hasText:"Small Steps"}).locator(".keyword-standings-rank")).toContainText("#7");
  const details = page.locator(".standings-comparison-details");
  await expect(details).not.toHaveAttribute("open");
  await details.locator("summary").click();
  await expect(page.getByRole("button",{name:"Refresh app metadata",exact:true})).toBeVisible();
  await details.locator("summary").click();
  await page.getByRole("button",{name:"Review selection",exact:true}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button",{name:"Remove",exact:true})).toHaveCount(2);
});

test("long history and keyword tables scroll inside bounded desktop regions", async ({page}) => {
  await page.goto("/app?demo=1");
  for (const section of ["Rank history", "Keywords"]) {
    await page.setViewportSize({width:1360,height:816});
    await page.getByRole("button",{name:section,exact:true}).click();
    await page.locator(".table-scroll tbody tr").first().waitFor();
    await page.locator(".table-scroll tbody").evaluate(body => {
      const rows=[...body.children];
      while(body.children.length<28) body.append(rows[body.children.length%rows.length].cloneNode(true));
    });
    for (const viewport of [{width:1360,height:816},{width:780,height:620},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      await expect.poll(()=>page.locator(".workspace-main").evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
      const table=page.locator(".table-scroll");
      await expect.poll(()=>table.evaluate(el=>el.clientHeight)).toBeGreaterThanOrEqual(75);
      expect(await table.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
      await table.evaluate(el=>{el.scrollTop=el.scrollHeight;});
      expect(await page.locator(".workspace-main").evaluate(el=>el.scrollTop)).toBe(0);
      if(section==="Rank history") await expect.poll(()=>page.locator(".chart-stage").evaluate(el=>el.clientHeight)).toBeGreaterThanOrEqual(75);
    }
  }
  await page.setViewportSize({width:320,height:568});
  await expect.poll(()=>page.locator(".table-scroll").evaluate(el=>el.clientHeight)).toBeGreaterThanOrEqual(100);
});
