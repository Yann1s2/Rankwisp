import test from "node:test";
import assert from "node:assert/strict";
import {
  parseImport,
  parseAppQuery,
  segments,
  quality,
  visibility,
  license,
  normalizeKeywords,
  DAY,
} from "../shared/domain.mjs";
import { demoWorkspace } from "../src/demo.mjs";
import {
  openDB,
  accountCreate,
  applyPayment,
  passwordMatches,
  transaction,
} from "../server/db.mjs";
import { advise } from "../server/ai.mjs";
import { appleClient } from "../server/apple.mjs";
const workspace = () => {
  const w = demoWorkspace();
  w.projects[0].keywords[0].samples[2].rank = null;
  w.projects[0].keywords[0].lastError = "timeout";
  w.projects[0].keywords[1].archived = true;
  w.extra = { retained: true };
  return w;
};
test("migration retains exact IDs, histories, null ranks, archives, errors and unknown fields", () => {
  const w = workspace();
  assert.deepEqual(parseImport(w).data, w);
  assert.deepEqual(parseImport({ workspace: w }).data, w);
  assert.equal(parseImport(w).summary.samples, 56);
});
test("migration rejects unknown schema and duplicate project IDs atomically", () => {
  const w = workspace();
  assert.throws(() => parseImport({ ...w, schemaVersion: 2 }));
  w.projects.push(structuredClone(w.projects[0]));
  assert.throws(() => parseImport(w));
});
test("query parser supports name, ID, Apple URL and rejects arbitrary URLs", () => {
  assert.deepEqual(
    parseAppQuery("https://apps.apple.com/ch/app/example/id123456789?l=de"),
    { id: "123456789" },
  );
  assert.deepEqual(parseAppQuery("123456789"), { id: "123456789" });
  assert.deepEqual(parseAppQuery("Habit planner"), { term: "Habit planner" });
  assert.throws(() => parseAppQuery("https://evil.test/id12345678"));
  assert.throws(() =>
    parseAppQuery("https://apps.apple.com@evil.test/id12345678"),
  );
});
test("normalization deduplicates and preserves unicode", () =>
  assert.deepEqual(normalizeKeywords(" Test ;TEST\nGrüezi   Welt"), [
    "test",
    "grüezi welt",
  ]));
test("curve segments break on missing results and gaps, retain latest duplicate timestamp", () => {
  const samples = [
    { date: "2026-01-01", rank: 10 },
    { date: "2026-01-02", rank: null },
    { date: "2026-01-03", rank: 8 },
    { date: "2026-01-03", rank: 7 },
    { date: "2026-01-06", rank: 5 },
  ];
  assert.deepEqual(
    segments(samples).map((s) => s.map((p) => p.rank)),
    [[10], [7], [5]],
  );
});
test("error takes precedence over stale valid data, null is not a fetch error", () => {
  const k = { samples: [{ date: new Date().toISOString(), rank: null }] };
  assert.equal(quality(k), "missing");
  assert.equal(quality({ ...k, lastError: "offline" }), "error");
  assert.equal(quality({ samples: [] }), "unmeasured");
});
test("visibility excludes stale, failed and unclassified keywords", () => {
  const p = workspace().projects[0];
  p.keywords.forEach((k) => (k.samples.at(-1).date = new Date().toISOString()));
  p.keywords[2].category = "unclassified";
  p.keywords[3].samples.forEach((s) => (s.date = "2020-01-01"));
  assert.equal(visibility(p).included.length, 0);
  assert.ok(visibility(p).values.every((v) => v.share === null));
});
test("server trial is precisely 24 days and never withholds read/export", () => {
  const a = {
    created: 1000,
    license: "trial",
    checks: 0,
    ai_count: 0,
    ai_spent: 0,
  };
  assert.equal(license(a, 1000 + 24 * DAY - 1).state, "trial");
  assert.equal(license(a, 1000 + 24 * DAY).state, "expired");
  assert.equal(license(a, 1000 + 100 * DAY).readable, true);
  assert.equal(
    license({ ...a, license: "paid" }, 1000 + 100 * DAY).state,
    "paid",
  );
});
test("payment processing is idempotent and delayed success cannot revive refund", () => {
  const db = openDB(":memory:");
  const a = accountCreate(db, "a@example.test", "long test passphrase");
  const event = {
    eventID: "evt-1",
    paymentID: "pay-1",
    account: a.id,
    status: "paid",
    provider: "stripe",
  };
  assert.equal(applyPayment(db, event), true);
  assert.equal(applyPayment(db, event), false);
  assert.equal(
    db.prepare("SELECT license FROM accounts").get().license,
    "paid",
  );
  applyPayment(db, { ...event, eventID: "evt-2", status: "revoked" });
  applyPayment(db, { ...event, eventID: "evt-3" });
  assert.equal(
    db.prepare("SELECT license FROM accounts").get().license,
    "trial",
  );
  db.close();
});
test("a payment cannot be claimed by a second account", () => {
  const db = openDB(":memory:");
  const a = accountCreate(db, "a@example.test", "long test passphrase"),
    b = accountCreate(db, "b@example.test", "long test passphrase");
  const e = {
    eventID: "evt",
    paymentID: "pay",
    account: a.id,
    status: "paid",
    provider: "apple",
  };
  applyPayment(db, e);
  assert.throws(() =>
    applyPayment(db, { ...e, eventID: "evt2", account: b.id }),
  );
  db.close();
});
test("passwords are salted and checked without plaintext storage", () => {
  const db = openDB(":memory:");
  const a = accountCreate(db, "a@example.test", "long test passphrase");
  assert.ok(passwordMatches("long test passphrase", a.password));
  assert.equal(passwordMatches("wrong passphrase", a.password), false);
  assert.notEqual(a.password, "long test passphrase");
  db.close();
});
test("AI no-key/consent fallback never invokes the provider", async () => {
  const db = openDB(":memory:");
  const a = accountCreate(db, "a@example.test", "long test passphrase");
  let calls = 0;
  const fetcher = () => {
    calls++;
  };
  const result = await advise(db, a, workspace().projects[0], {
    env: { OPENAI_API_KEY: "test" },
    fetcher,
  });
  assert.equal(result.reason, "CONSENT_REQUIRED");
  assert.equal(calls, 0);
  const noKey = await advise(
    db,
    { ...a, ai_consent: 1 },
    workspace().projects[0],
    { env: {}, fetcher },
  );
  assert.equal(noKey.reason, "AI_NOT_CONFIGURED");
  db.close();
});
test("AI cache is tenant scoped and budget reserve blocks concurrent overspend", async () => {
  const db = openDB(":memory:");
  const a = accountCreate(db, "a@example.test", "long test passphrase");
  db.prepare("UPDATE accounts SET ai_consent=1 WHERE id=?").run(a.id);
  const account = { ...a, ai_consent: 1 };
  let calls = 0;
  const fetcher = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return new Response(
      JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "Review fresh observations." },
            ],
          },
        ],
      }),
    );
  };
  const options = {
    fetcher,
    env: { OPENAI_API_KEY: "test", AI_GLOBAL_BUDGET_USD: "0.02" },
  };
  const results = await Promise.all([
    advise(db, account, workspace().projects[0], options),
    advise(db, account, workspace().projects[0], options),
  ]);
  assert.equal(calls, 1);
  assert.equal(results.filter((r) => r.reason === "AI_BUDGET").length, 1);
  const cached = await advise(db, account, workspace().projects[0], options);
  assert.equal(cached.cached, true);
  assert.equal(calls, 1);
  assert.equal(
    db.prepare("SELECT ai_spent FROM accounts").get().ai_spent,
    0.02,
  );
  db.close();
});
test("AI provider failure yields transparent fallback without automatic retry", async () => {
  const db = openDB(":memory:");
  const a = accountCreate(db, "a@example.test", "long test passphrase");
  db.prepare("UPDATE accounts SET ai_consent=1").run();
  let calls = 0;
  const result = await advise(
    db,
    { ...a, ai_consent: 1 },
    workspace().projects[0],
    {
      env: { OPENAI_API_KEY: "test" },
      fetcher: async () => {
        calls++;
        throw Error("network");
      },
    },
  );
  assert.equal(result.reason, "AI_UNAVAILABLE");
  assert.equal(calls, 1);
  db.close();
});
test("Apple deduplicates concurrent requests, retains provenance, rejects malformed response", async () => {
  const db = openDB(":memory:");
  let calls = 0;
  const apple = appleClient(db, {
    spacing: 0,
    fetcher: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          results: [
            {
              trackId: 123456789,
              trackName: "Test",
              artworkUrl100: "https://is1-ssl.mzstatic.com/test.png",
            },
          ],
        }),
        { headers: { date: "Mon, 01 Jan 2026 00:00:00 GMT", age: "10" } },
      );
    },
  });
  const [a, b] = await Promise.all([
    apple.search("test", "ch"),
    apple.search("test", "ch"),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.results[0].id, 123456789);
  assert.equal(a.cacheAge, "10");
  assert.equal(b.fetchedAt, a.fetchedAt);
  assert.equal((await apple.search("test", "ch")).cached, true);
  const bad = appleClient(db, {
    spacing: 0,
    fetcher: async () => new Response("{}"),
  });
  await assert.rejects(() => bad.search("bad", "ch"), /APPLE_INVALID_RESPONSE/);
  db.close();
});

test("iOS free trial awaits verified StoreKit activation; purchase replay cannot reset it", async () => {
  const { applyAppleTrial } = await import("../server/db.mjs");
  const db = openDB(":memory:");
  const a = accountCreate(
    db,
    "ios@example.test",
    "long test passphrase",
    Date.now(),
    true,
  );
  assert.equal(license(a).state, "pending");
  assert.equal(license(a).writable, false);
  const purchaseDate = Date.now() - DAY;
  applyAppleTrial(db, {
    transactionID: "trial-1",
    account: a.id,
    purchaseDate,
  });
  assert.equal(
    license(db.prepare("SELECT * FROM accounts WHERE id=?").get(a.id))
      .daysRemaining,
    23,
  );
  applyAppleTrial(db, {
    transactionID: "trial-1",
    account: a.id,
    purchaseDate: Date.now(),
  });
  assert.equal(
    db.prepare("SELECT trial_started FROM accounts WHERE id=?").get(a.id)
      .trial_started,
    purchaseDate,
  );
  db.close();
});
