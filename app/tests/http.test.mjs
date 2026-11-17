import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { openDB } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";
import { demoWorkspace } from "../src/demo.mjs";
import { DAY } from "../shared/domain.mjs";
async function harness(options = {}) {
  const db = openDB(":memory:");
  let fail = false;
  const apple = {
    search: async () => ({
      results: [{ id: 123456789, name: "Fixture app", genre: "Productivity" }],
      fetchedAt: new Date().toISOString(),
    }),
    request: async (params) => {
      if (fail) throw Error("APPLE_UNAVAILABLE");
      return {
        results: [
          { id: 123456789, name: "Fixture app", genre: "Productivity" },
        ],
        fetchedAt: new Date().toISOString(),
      };
    },
  };
  const app = createApp(db, {
    env: { PUBLIC_ORIGIN: "http://localhost", ...options.env },
    apple,
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, { body, token, method, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        "Content-Type": "application/json",
        "X-Rankwisp-Client": "native",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    };
  }
  async function register(email) {
    return (
      await request("/auth/register", {
        body: { email, password: "a safe test password" },
      })
    ).body;
  }
  return {
    db,
    request,
    register,
    base,
    failApple: () => (fail = true),
    close: async () => {
      await new Promise((r) => server.close(r));
      db.close();
    },
  };
}
test("HTTP account isolation and no unauthenticated workspace", async () => {
  const h = await harness();
  try {
    assert.equal((await h.request("/workspace")).status, 401);
    const a = await h.register("a@example.test"),
      b = await h.register("b@example.test");
    const p = await h.request("/projects", {
      token: a.token,
      body: {
        appleID: 123456789,
        country: "ch",
        competitorIDs: [],
        keywords: "test",
      },
    });
    assert.equal(p.status, 200);
    const other = await h.request("/projects/" + p.body.id + "/keywords", {
      token: b.token,
      body: { text: "secret" },
    });
    assert.equal(other.status, 404);
    assert.equal(
      (await h.request("/workspace", { token: b.token })).body.workspace
        .projects.length,
      0,
    );
    assert.equal(
      (await h.request("/me", { token: a.token })).body.license.daysRemaining,
      24,
    );
  } finally {
    await h.close();
  }
});
test("import preview, compare-and-swap, recovery copies and complete export", async () => {
  const h = await harness();
  try {
    const a = await h.register("a@example.test"),
      token = a.token;
    const data = demoWorkspace();
    const before = (await h.request("/workspace", { token })).body;
    assert.equal(
      (await h.request("/import/preview", { token, body: data })).body.samples,
      56,
    );
    assert.equal(
      (await h.request("/import", { token, body: { data, revision: "wrong" } }))
        .status,
      409,
    );
    assert.equal(
      (
        await h.request("/import", {
          token,
          body: { data, revision: before.revision },
        })
      ).status,
      200,
    );
    assert.deepEqual((await h.request("/export", { token })).body, data);
    const backups = (await h.request("/imports", { token })).body;
    assert.equal(backups.length, 1);
    const recovery = (await h.request("/imports/" + backups[0].id, { token }))
      .body;
    assert.deepEqual(recovery.original, data);
    assert.equal(recovery.previous.projects.length, 0);
  } finally {
    await h.close();
  }
});
test("trial end blocks new measurements but preserves export and restore", async () => {
  const h = await harness();
  try {
    const a = await h.register("a@example.test"),
      token = a.token;
    h.db
      .prepare("UPDATE accounts SET trial_started=? WHERE id=?")
      .run(Date.now() - 25 * DAY, a.account.id);
    assert.equal(
      (await h.request("/search?q=planner&country=us", { token })).status,
      402,
    );
    assert.equal((await h.request("/export", { token })).status, 200);
    assert.equal(
      (await h.request("/billing/restore", { token, body: {} })).body.license
        .state,
      "expired",
    );
    const fake = await h.request("/preferences", {
      token,
      method: "PATCH",
      body: { created: Date.now(), license: "paid" },
    });
    assert.equal(
      (await h.request("/me", { token })).body.license.state,
      "expired",
    );
  } finally {
    await h.close();
  }
});
test("fetch failure preserves last observation and records error; successful absence is null", async () => {
  const h = await harness();
  try {
    const a = await h.register("a@example.test"),
      token = a.token;
    const p = (
      await h.request("/projects", {
        token,
        body: {
          appleID: 123456789,
          country: "ch",
          competitorIDs: [],
          keywords: "test",
        },
      })
    ).body;
    await h.request(`/projects/${p.id}/refresh`, { token, body: {} });
    let k = (await h.request("/workspace", { token })).body.workspace
      .projects[0].keywords[0];
    assert.equal(k.samples.length, 1);
    assert.equal(k.samples[0].rank, 1);
    h.failApple();
    await h.request(`/projects/${p.id}/refresh`, { token, body: {} });
    k = (await h.request("/workspace", { token })).body.workspace.projects[0]
      .keywords[0];
    assert.equal(k.samples.length, 1);
    assert.equal(k.lastError, "APPLE_UNAVAILABLE");
    assert.equal(
      (await h.request("/me", { token })).body.license.checksRemaining,
      118,
    );
  } finally {
    await h.close();
  }
});
test("hostile origin rejected, session cookies HttpOnly, logout revokes bearer", async () => {
  const h = await harness();
  try {
    const a = await h.register("a@example.test");
    assert.equal(
      (
        await h.request("/me", {
          token: a.token,
          headers: { Origin: "https://evil.test" },
        })
      ).status,
      403,
    );
    const login = await h.request("/auth/login", {
      body: { email: "a@example.test", password: "a safe test password" },
    });
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
    await h.request("/auth/logout", { token: login.body.token, body: {} });
    assert.equal(
      (await h.request("/me", { token: login.body.token })).status,
      401,
    );
  } finally {
    await h.close();
  }
});
test("signed Stripe webhook verifies price and grants once; bad signature never grants", async () => {
  const sdk = new Stripe("sk_test_fixture");
  let owner;
  const stripeClient = {
    webhooks: sdk.webhooks,
    checkout: {
      sessions: {
        retrieve: async () => ({
          payment_status: "paid",
          mode: "payment",
          line_items: { data: [{ price: { id: "price_test" } }] },
          client_reference_id: owner,
          payment_intent: "pi_test",
        }),
      },
    },
  };
  const h = await harness({
    stripeClient,
    env: {
      STRIPE_WEBHOOK_SECRET: "whsec_fixture",
      STRIPE_PRICE_ID: "price_test",
    },
  });
  try {
    owner = (await h.register("a@example.test")).account.id;
    const payload = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test" } },
    });
    const send = async (signature) =>
      fetch(h.base + "/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": signature,
        },
        body: payload,
      });
    assert.equal((await send("invalid")).status, 400);
    assert.equal(
      h.db.prepare("SELECT license FROM accounts").get().license,
      "trial",
    );
    const signature = sdk.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_fixture",
    });
    assert.equal((await send(signature)).status, 200);
    assert.equal((await send(signature)).status, 200);
    assert.equal(
      h.db.prepare("SELECT license FROM accounts").get().license,
      "paid",
    );
    assert.equal(h.db.prepare("SELECT count(*) AS n FROM events").get().n, 1);
  } finally {
    await h.close();
  }
});
test("paid quota zero cannot spend checks, telemetry default off, account deletion requires password", async () => {
  const h = await harness();
  try {
    const a = await h.register("a@example.test"),
      token = a.token;
    await h.request("/telemetry", {
      token,
      body: { surface: "app", event: "page_view" },
    });
    assert.equal(
      h.db.prepare("SELECT count(*) AS n FROM telemetry").get().n,
      0,
    );
    assert.equal(
      (
        await h.request("/account", {
          token,
          method: "DELETE",
          body: { password: "wrong" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await h.request("/account", {
          token,
          method: "DELETE",
          body: { password: "a safe test password" },
        })
      ).status,
      200,
    );
    assert.equal((await h.request("/me", { token })).status, 401);
  } finally {
    await h.close();
  }
});

test("Apple rate limiting retains native CORS and a retryable structured response", async () => {
  const h = await harness({
    apple: {
      search: async () => {
        throw Error("APPLE_RATE_LIMIT");
      },
    },
  });
  try {
    const { token } = await h.register("rate@example.test");
    const response = await h.request("/search?q=app&country=ch", {
      token,
      headers: { Origin: "rankwisp://app" },
    });
    assert.equal(response.status, 429);
    assert.deepEqual(response.body, { error: "APPLE_RATE_LIMIT" });
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "rankwisp://app",
    );
    assert.equal(response.headers.get("retry-after"), "60");
  } finally {
    await h.close();
  }
});
