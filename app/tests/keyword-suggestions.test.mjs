import test from "node:test";
import assert from "node:assert/strict";
import { openDB } from "../server/db.mjs";
import { accountCreate } from "../server/db-core.mjs";
import { suggestKeywords } from "../server/ai.mjs";
const input = {
  appleID: 123456789,
  country: "de",
  locale: "en",
  existingKeywords: ["task list"],
};
const app = {
  id: 123456789,
  name: "Planner",
  genre: "Productivity",
  description: "A task and reminder organizer.",
};
const reply = (suggestions) =>
  Response.json({
    status: "completed",
    output: [
      {
        content: [
          { type: "output_text", text: JSON.stringify({ suggestions }) },
        ],
      },
    ],
  });
function setup() {
  const db = openDB(":memory:");
  const a = accountCreate(db, "a@example.test", "a test passphrase");
  const consent = () =>
    db.prepare("UPDATE accounts SET ai_consent=1 WHERE id=?").run(a.id);
  const apple = { request: async () => ({ results: [app] }) };
  return {
    db,
    a,
    consent,
    options: { env: { OPENAI_API_KEY: "fixture" }, apple },
  };
}
test("keyword suggestions require consent/key before any Apple/provider request", async () => {
  const { db, a, consent, options } = setup();
  try {
    options.apple.request = options.fetcher = () =>
      assert.fail("No network permitted");
    assert.equal(
      (await suggestKeywords(db, a, input, options)).reason,
      "CONSENT_REQUIRED",
    );
    consent();
    options.env = {};
    assert.equal(
      (await suggestKeywords(db, a, input, options)).reason,
      "AI_NOT_CONFIGURED",
    );
    assert.equal(db.prepare("SELECT ai_count FROM accounts").get().ai_count, 0);
  } finally {
    db.close();
  }
});
test("Luna returns deduped proposals only; cache and quota are tenant scoped, language follows storefront", async () => {
  const { db, a, consent, options } = setup();
  try {
    consent();
    const before = db
      .prepare("SELECT workspace FROM accounts WHERE id=?")
      .get(a.id).workspace;
    let calls = 0;
    options.fetcher = async (url, init) => {
      calls++;
      const body = JSON.parse(init.body);
      assert.equal(body.model, "gpt-6-luna");
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.match(body.instructions, /ideas in German/);
      assert.match(body.instructions, /explanations in English/);
      assert.deepEqual(JSON.parse(body.input).app, {
        name: app.name,
        developer: "",
        genre: app.genre,
        description: app.description,
      });
      return reply([
        { keyword: " Task list ", reason: "Existing" },
        { keyword: "Planer", reason: "Task planning" },
        { keyword: "Ｐｌａｎｅｒ", reason: "Duplicate" },
        {
          keyword: "Ａ，Ｂ",
          reason: "Normalized delimiter must not become two saved keywords",
        },
      ]);
    };
    const value = await suggestKeywords(db, a, input, options);
    assert.deepEqual(value.suggestions, [
      { keyword: "planer", reason: "Task planning" },
    ]);
    assert.equal(value.cached, false);
    value.suggestions[0].keyword = "User edit does not mutate database";
    assert.equal((await suggestKeywords(db, a, input, options)).cached, true);
    assert.equal(calls, 1);
    assert.equal(
      db.prepare("SELECT workspace FROM accounts WHERE id=?").get(a.id)
        .workspace,
      before,
    );
    const b = accountCreate(db, "b@example.test", "a test passphrase");
    db.prepare("UPDATE accounts SET ai_consent=1 WHERE id=?").run(b.id);
    assert.equal((await suggestKeywords(db, b, input, options)).cached, false);
    assert.equal(calls, 2);
    db.prepare("UPDATE accounts SET ai_count=100 WHERE id=?").run(b.id);
    assert.equal(
      (
        await suggestKeywords(
          db,
          b,
          { ...input, existingKeywords: [] },
          options,
        )
      ).reason,
      "AI_BUDGET",
    );
    assert.equal(calls, 2);
    assert.equal(
      db.prepare("SELECT ai_count FROM accounts WHERE id=?").get(a.id).ai_count,
      1,
    );
  } finally {
    db.close();
  }
});
test("malformed, overlong, score-bearing and incomplete provider outputs fail closed without retry", async () => {
  for (const output of [
    { suggestions: [{ keyword: "planner", reason: "yes", rank: 1 }] },
    { suggestions: [{ keyword: "a".repeat(61), reason: "yes" }] },
    {
      suggestions: Array.from({ length: 11 }, () => ({
        keyword: "planner",
        reason: "yes",
      })),
    },
    { suggestions: [{ keyword: "planner\nignored", reason: "yes" }] },
    { text: "markdown" },
  ]) {
    const { db, a, consent, options } = setup();
    try {
      consent();
      let calls = 0;
      options.fetcher = async () => {
        calls++;
        return Response.json({
          output: [
            {
              content: [{ type: "output_text", text: JSON.stringify(output) }],
            },
          ],
        });
      };
      const result = await suggestKeywords(db, a, input, options);
      assert.equal(result.mode, "unavailable");
      assert.equal(result.reason, "AI_UNAVAILABLE");
      assert.equal(calls, 1);
      assert.equal(
        db.prepare("SELECT ai_count FROM accounts").get().ai_count,
        1,
      );
      assert.equal(db.prepare("SELECT count(*) AS n FROM cache").get().n, 0);
    } finally {
      db.close();
    }
  }
});
test("concurrent suggestion requests cannot exceed budget and revoked consent stops provider dispatch", async () => {
  const { db, a, consent, options } = setup();
  try {
    consent();
    options.env.AI_GLOBAL_BUDGET_USD = "0.02";
    let calls = 0;
    options.fetcher = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return reply([{ keyword: "planer", reason: "Planning" }]);
    };
    const result = await Promise.all([
      suggestKeywords(db, a, input, options),
      suggestKeywords(db, a, input, options),
    ]);
    assert.equal(calls, 1);
    assert.equal(result.filter((x) => x.reason === "AI_BUDGET").length, 1);
    options.apple.request = async () => {
      db.prepare("UPDATE accounts SET ai_consent=0").run();
      return { results: [app] };
    };
    assert.equal(
      (await suggestKeywords(db, a, input, options)).reason,
      "CONSENT_REQUIRED",
    );
    assert.equal(calls, 1);
  } finally {
    db.close();
  }
});

test("incomplete or refused generation is unavailable even if a partial JSON body is usable", async () => {
  for (const status of ["incomplete", "failed", "refused"]) {
    const { db, a, consent, options } = setup();
    try {
      consent();
      options.fetcher = async () =>
        Response.json({
          status: status === "refused" ? "completed" : status,
          output: [
            {
              content: [
                ...(status === "refused"
                  ? [{ type: "refusal", refusal: "Cannot answer" }]
                  : []),
                {
                  type: "output_text",
                  text: JSON.stringify({
                    suggestions: [{ keyword: "planer", reason: "Planning" }],
                  }),
                },
              ],
            },
          ],
        });
      assert.equal(
        (await suggestKeywords(db, a, input, options)).reason,
        "AI_UNAVAILABLE",
      );
    } finally {
      db.close();
    }
  }
});

test("total suggestion deadline prevents late paid dispatch after slow Apple/global reservation", async () => {
  for (const slow of ["apple", "reservation"]) {
    const { db, a, consent, options } = setup();
    try {
      consent();
      let clock = 1000;
      options.now = () => clock;
      options.apple.request = async () => {
        if (slow === "apple") clock += 41000;
        return { results: [app] };
      };
      options.reserveGlobal = async () => {
        if (slow === "reservation") clock += 41000;
        return true;
      };
      options.fetcher = () => assert.fail("No paid dispatch after deadline");
      const result = await suggestKeywords(db, a, input, options);
      assert.equal(
        result.reason,
        slow === "apple" ? "APPLE_UNAVAILABLE" : "AI_UNAVAILABLE",
      );
      assert.equal(
        db.prepare("SELECT ai_count FROM accounts").get().ai_count,
        slow === "apple" ? 0 : 1,
      );
    } finally {
      db.close();
    }
  }
});
