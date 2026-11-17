import { describe, it, expect, vi, afterEach } from "vitest";
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import worker from "../index.mjs";
import { hash } from "../../server/db-core.mjs";
import { emptyWorkspace } from "../../shared/domain.mjs";
import { randomToken, challengeFor, verifyGoogleIDToken } from "../auth.mjs";
import { SignJWT, generateKeyPair, createLocalJWKSet, exportJWK } from "jose";
const origin = "https://rankwisp.pages.dev";
const call = (
  path,
  { method = "GET", body, token, headers = {}, environment = env } = {},
) =>
  worker.fetch(
    new Request(origin + path, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: "Bearer " + token } : {}),
        ...(method !== "GET" ? { origin } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    environment,
  );
async function user(platform = "web", age = 0) {
  const id = crypto.randomUUID(),
    token = randomToken(),
    email = id + "@example.test",
    created = Date.now() - age;
  await env.IDENTITY.prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .bind(id, id, email, created, platform)
    .run();
  await env.IDENTITY.prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .bind(hash(token), id, Date.now(), Date.now() + 86400000)
    .run();
  const stub = env.ACCOUNTS.getByName(id);
  await stub.initialize({ id, email, created, platform });
  return { id, token, stub };
}
afterEach(() => vi.restoreAllMocks());
describe("Workers + real local D1 and account Durable Objects", () => {
  it("health/config, unavailable Google, CORS and unauthenticated reads", async () => {
    expect((await call("/api/health")).status).toBe(200);
    const cfg = await (
      await call("/api/config", {
        environment: { ...env, GOOGLE_CLIENT_SECRET: "" },
      })
    ).json();
    expect(cfg.googleConfigured).toBe(false);
    expect((await call("/api/workspace")).status).toBe(401);
    expect(
      (await call("/api/config", { headers: { origin: "https://evil.test" } }))
        .status,
    ).toBe(403);
    expect(
      (
        await call("/api/auth/google/native/start", {
          method: "POST",
          body: {},
          environment: { ...env, GOOGLE_CLIENT_SECRET: "" },
        })
      ).status,
    ).toBe(503);
  });
  it("isolates accounts, imports losslessly, rejects revision conflict and exports after trial", async () => {
    const a = await user(),
      b = await user("web", 30 * 86400000);
    const original = { ...emptyWorkspace(), opaque: { future: true } };
    const before = await (
      await call("/api/workspace", { token: a.token })
    ).json();
    let r = await call("/api/import", {
      method: "POST",
      token: a.token,
      body: { data: original, revision: before.revision },
    });
    expect(r.status).toBe(200);
    expect(
      (await (await call("/api/export", { token: a.token })).json()).opaque,
    ).toEqual({ future: true });
    expect(
      (await (await call("/api/export", { token: b.token })).json()).opaque,
    ).toBeUndefined();
    r = await call("/api/import", {
      method: "POST",
      token: a.token,
      body: { data: original, revision: "wrong" },
    });
    expect(r.status).toBe(409);
    expect(
      (await call("/api/search?country=us&q=test", { token: b.token })).status,
    ).toBe(402);
    expect((await call("/api/export", { token: b.token })).status).toBe(200);
  });
  it("Google users have provider metadata; logout revokes session", async () => {
    const a = await user();
    const me = await (await call("/api/me", { token: a.token })).json();
    expect(me.authProvider).toBe("google");
    expect(me.hasPassword).toBe(false);
    expect(
      (
        await call("/api/auth/logout", {
          method: "POST",
          token: a.token,
          body: {},
        })
      ).status,
    ).toBe(200);
    expect((await call("/api/me", { token: a.token })).status).toBe(401);
  });
  it("native exchange requires matching verifier and consumes ticket once", async () => {
    const a = await user(),
      verifier = randomToken();
    const r = await call("/api/auth/google/native/start", {
      method: "POST",
      body: { challenge: await challengeFor(verifier), platform: "desktop" },
    });
    expect(r.status).toBe(200);
    const { ticket } = await r.json();
    expect(
      (
        await call("/api/auth/google/native/exchange", {
          method: "POST",
          body: { ticket, verifier },
        })
      ).status,
    ).toBe(202);
    expect(
      (
        await call("/api/auth/google/native/exchange", {
          method: "POST",
          body: { ticket, verifier: randomToken() },
        })
      ).status,
    ).toBe(401);
    await env.IDENTITY.prepare(
      "UPDATE native_auth SET status='complete',user_id=? WHERE ticket_hash=?",
    )
      .bind(a.id, hash(ticket))
      .run();
    const success = await call("/api/auth/google/native/exchange", {
      method: "POST",
      body: { ticket, verifier },
    });
    const data = await success.json();
    expect(data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await call("/api/me", { token: data.token })).status).toBe(200);
    expect(
      (
        await call("/api/auth/google/native/exchange", {
          method: "POST",
          body: { ticket, verifier },
        })
      ).status,
    ).toBe(401);
  });
  it("OAuth start uses PKCE and nonce; missing browser binding rejects callback; cancellation consumes state", async () => {
    const start = await call("/api/auth/google/start");
    expect(start.status).toBe(302);
    const destination = new URL(start.headers.get("location"));
    expect(destination.origin).toBe("https://accounts.google.com");
    expect(destination.searchParams.get("code_challenge_method")).toBe("S256");
    expect(destination.searchParams.get("nonce")).toBeTruthy();
    const state = destination.searchParams.get("state"),
      cookie = start.headers.get("set-cookie").split(";")[0];
    expect(
      (
        await call(
          "/api/auth/google/callback?state=" + state + "&error=access_denied",
        )
      ).status,
    ).toBe(401);
    const cancelled = await call(
      "/api/auth/google/callback?state=" + state + "&error=access_denied",
      { headers: { cookie } },
    );
    expect(cancelled.headers.get("location")).toContain("GOOGLE_CANCELLED");
    expect(
      (
        await call(
          "/api/auth/google/callback?state=" + state + "&error=access_denied",
          { headers: { cookie } },
        )
      ).status,
    ).toBe(401);
  });
  it("OIDC rejects invalid nonce, issuer, audience and unverified email", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test";
    const keySet = createLocalJWKSet({ keys: [jwk] });
    const token = async (extra = {}) =>
      new SignJWT({
        email: "person@example.test",
        email_verified: true,
        nonce: "n",
        ...extra,
      })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer("https://accounts.google.com")
        .setAudience("client")
        .setSubject("subject")
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(privateKey);
    expect(
      await verifyGoogleIDToken(await token(), {
        clientId: "client",
        nonce: "n",
        keySet,
      }),
    ).toEqual({ sub: "subject", email: "person@example.test" });
    await expect(
      verifyGoogleIDToken(await token(), {
        clientId: "other",
        nonce: "n",
        keySet,
      }),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIDToken(await token(), {
        clientId: "client",
        nonce: "wrong",
        keySet,
      }),
    ).rejects.toThrow();
    await expect(
      verifyGoogleIDToken(await token({ email_verified: false }), {
        clientId: "client",
        nonce: "n",
        keySet,
      }),
    ).rejects.toThrow();
  });
  it("per-account payment state is idempotent; partial status dispute can recover, refund cannot", async () => {
    const a = await user();
    const event = {
      eventID: "e1",
      paymentID: "p1",
      account: a.id,
      status: "paid",
      provider: "stripe",
    };
    expect(await a.stub.payment(event)).toBe(true);
    expect(await a.stub.payment(event)).toBe(false);
    await a.stub.payment({ ...event, eventID: "e2", status: "disputed" });
    expect(
      (await (await call("/api/me", { token: a.token })).json()).license.state,
    ).not.toBe("paid");
    await a.stub.payment({
      ...event,
      eventID: "e3",
      status: "paid",
      disputeResolved: true,
    });
    expect(
      (await (await call("/api/me", { token: a.token })).json()).license.state,
    ).toBe("paid");
    await a.stub.payment({ ...event, eventID: "e4", status: "revoked" });
    await a.stub.payment({ ...event, eventID: "e5", status: "paid" });
    expect(
      (await (await call("/api/me", { token: a.token })).json()).license.state,
    ).not.toBe("paid");
  });
  it("global AI reservations are atomic under concurrent account requests", async () => {
    const c = env.COORDINATOR.getByName("budget-test");
    const outcomes = await Promise.all(
      Array.from({ length: 25 }, () => c.reserveAI(1)),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(20);
  });
  it("account deletion requires confirmation and recent session", async () => {
    const a = await user();
    expect(
      (
        await call("/api/account", {
          method: "DELETE",
          token: a.token,
          body: {},
        })
      ).status,
    ).toBe(400);
    await env.IDENTITY.prepare(
      "UPDATE sessions SET created=? WHERE token_hash=?",
    )
      .bind(Date.now() - 700000, hash(a.token))
      .run();
    expect(
      (
        await call("/api/account", {
          method: "DELETE",
          token: a.token,
          body: { confirm: "DELETE" },
        })
      ).status,
    ).toBe(403);
    await env.IDENTITY.prepare(
      "UPDATE sessions SET created=? WHERE token_hash=?",
    )
      .bind(Date.now(), hash(a.token))
      .run();
    expect(
      (
        await call("/api/account", {
          method: "DELETE",
          token: a.token,
          body: { confirm: "DELETE" },
        })
      ).status,
    ).toBe(200);
    expect((await call("/api/me", { token: a.token })).status).toBe(401);
  });
});

it("full Google callback validates signed OIDC, creates D1 identity and restores HttpOnly session", async () => {
  const start = await call("/api/auth/google/start");
  const destination = new URL(start.headers.get("location"));
  const nonce = destination.searchParams.get("nonce"),
    state = destination.searchParams.get("state"),
    cookie = start.headers.get("set-cookie").split(";")[0];
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "google-test",
    use: "sig",
    alg: "RS256",
  };
  const idToken = await new SignJWT({
    email: "oidc-" + crypto.randomUUID() + "@example.test",
    email_verified: true,
    nonce,
  })
    .setProtectedHeader({ alg: "RS256", kid: "google-test" })
    .setIssuer("https://accounts.google.com")
    .setAudience(env.GOOGLE_CLIENT_ID)
    .setSubject(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      const body = new URLSearchParams(options.body);
      expect(body.get("code_verifier")).toBeTruthy();
      return Response.json({ id_token: idToken });
    }
    if (url === "https://www.googleapis.com/oauth2/v3/certs")
      return Response.json({ keys: [jwk] });
    throw Error("Unexpected network " + url);
  });
  const callback = await call(
    "/api/auth/google/callback?state=" + state + "&code=provider-code",
    { headers: { cookie } },
  );
  expect(callback.status).toBe(303);
  expect(callback.headers.get("location")).toBe(origin + "/app");
  const cookies = callback.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith("rankwisp="));
  expect(session).toContain("HttpOnly");
  expect(session).toContain("Secure");
  const me = await call("/api/me", {
    headers: { cookie: session.split(";")[0] },
  });
  expect(me.status).toBe(200);
  expect((await me.json()).authProvider).toBe("google");
});

it("durable refresh processes six keywords, stores real API provenance, survives internal rate limits", async () => {
  const a = await user();
  const project = {
    id: "job-project",
    appleID: 904237743,
    name: "Fixture",
    country: "us",
    archived: false,
    competitors: [],
    storeSnapshots: [],
    keywords: Array.from({ length: 6 }, (_, i) => ({
      id: "kw-" + i,
      text: "keyword " + i,
      category: "core",
      samples: [],
      archived: false,
    })),
  };
  const before = await (
    await call("/api/workspace", { token: a.token })
  ).json();
  expect(
    (
      await call("/api/import", {
        method: "POST",
        token: a.token,
        body: {
          data: { ...emptyWorkspace(), projects: [project] },
          revision: before.revision,
        },
      })
    ).status,
  ).toBe(200);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    expect(new URL(String(input)).hostname).toBe("itunes.apple.com");
    return Response.json(
      {
        resultCount: 1,
        results: [
          {
            trackId: 904237743,
            trackName: "Fixture",
            artistName: "Test developer",
          },
        ],
      },
      { headers: { date: new Date().toUTCString() } },
    );
  });
  // Zero pacing only in this deterministic test, through a test-only DO instance callback.
  await runInDurableObject(
    env.COORDINATOR.getByName("provider-coordination"),
    async (instance) => {
      const { appleClient } = await import("../../server/apple.mjs");
      instance.apple = appleClient(instance.db, { spacing: 0 });
    },
  );
  const queued = await call("/api/projects/job-project/refresh", {
    method: "POST",
    token: a.token,
    body: {},
  });
  expect(queued.status).toBe(202);
  const job = await queued.json();
  for (let i = 0; i < 6; i++)
    expect(await runDurableObjectAlarm(a.stub)).toBe(true);
  const status = await (
    await call("/api/jobs/" + job.jobId, { token: a.token })
  ).json();
  expect(status.status).toBe("completed");
  expect(status.completed).toBe(6);
  expect(status.errors).toBe(0);
  const workspace = await (
    await call("/api/export", { token: a.token })
  ).json();
  expect(
    workspace.projects[0].keywords.every(
      (k) =>
        k.samples.length === 1 &&
        k.samples[0].rank === 1 &&
        k.samples[0].source === "apple-search-v1",
    ),
  ).toBe(true);
});

it("chunks multi-megabyte Unicode imports and both recovery snapshots without truncation", async () => {
  const a = await user();
  const extra = "é🪶".repeat(1400000);
  const original = { ...emptyWorkspace(), extra };
  const before = await (
    await call("/api/workspace", { token: a.token })
  ).json();
  const imported = await call("/api/import", {
    method: "POST",
    token: a.token,
    body: { data: original, revision: before.revision },
  });
  expect(imported.status).toBe(200);
  const exported = await (await call("/api/export", { token: a.token })).json();
  expect(hash(exported.extra)).toBe(hash(extra));
  const backups = await (await call("/api/imports", { token: a.token })).json();
  const backup = await (
    await call("/api/imports/" + backups[0].id, { token: a.token })
  ).json();
  expect(hash(backup.original.extra)).toBe(hash(extra));
  expect(backup.previous.schemaVersion).toBe(before.workspace.schemaVersion);
});

it("storage capacity rejection is atomic; exported 13MiB data can be re-imported", async () => {
  const a = await user(),
    extra = "x".repeat(13 * 1024 * 1024);
  let before = await (await call("/api/workspace", { token: a.token })).json();
  const big = { ...emptyWorkspace(), extra };
  expect(
    (
      await call("/api/import", {
        method: "POST",
        token: a.token,
        body: { data: big, revision: before.revision },
      })
    ).status,
  ).toBe(200);
  before = await (await call("/api/workspace", { token: a.token })).json();
  const me = await (await call("/api/me", { token: a.token })).json();
  expect(me.storage.bytes).toBeGreaterThan(13 * 1024 * 1024);
  expect(me.storage.limitBytes).toBe(16777216);
  const rejected = await call("/api/import", {
    method: "POST",
    token: a.token,
    body: {
      data: { ...big, extra: "z".repeat(17 * 1024 * 1024) },
      revision: before.revision,
    },
  });
  expect(rejected.status).toBe(413);
  expect((await rejected.json()).error).toBe("WORKSPACE_STORAGE_LIMIT");
  const after = await (await call("/api/workspace", { token: a.token })).json();
  expect(after.revision).toBe(before.revision);
  expect(
    (
      await call("/api/import", {
        method: "POST",
        token: a.token,
        body: { data: after.workspace, revision: after.revision },
      })
    ).status,
  ).toBe(200);
});

it("delayed payment success cannot clear an open dispute", async () => {
  const a = await user();
  const event = {
    eventID: "q1",
    paymentID: "q-payment",
    account: a.id,
    status: "paid",
    provider: "stripe",
  };
  await a.stub.payment(event);
  await a.stub.payment({ ...event, eventID: "q2", status: "disputed" });
  await a.stub.payment({ ...event, eventID: "q3", status: "paid" });
  expect(
    (await (await call("/api/me", { token: a.token })).json()).license.state,
  ).not.toBe("paid");
});

it("branch origins are accepted only by explicitly configured preview environment", async () => {
  const headers = { origin: "https://commit123.rankwisp.pages.dev" };
  expect((await call("/api/config", { headers })).status).toBe(403);
  expect(
    (
      await call("/api/config", {
        headers,
        environment: { ...env, PREVIEW_PAGES_PROJECT: "rankwisp" },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await call("/api/config", {
        headers: { origin: "https://rankwisp.pages.dev.evil.test" },
        environment: { ...env, PREVIEW_PAGES_PROJECT: "rankwisp" },
      })
    ).status,
  ).toBe(403);
});

it("OAuth aliases canonicalize before setting browser-binding cookie or state", async () => {
  const canonical = "https://rankwisp.zhstudio.ch";
  const environment = {
    ...env,
    PUBLIC_ORIGIN: canonical,
    GOOGLE_REDIRECT_URI: canonical + "/api/auth/google/callback",
  };
  const before = await env.IDENTITY.prepare(
    "SELECT COUNT(*) AS count FROM oauth_states",
  ).first();
  const response = await call("/api/auth/google/start", { environment });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    canonical + "/api/auth/google/start",
  );
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(
    (
      await env.IDENTITY.prepare(
        "SELECT COUNT(*) AS count FROM oauth_states",
      ).first()
    ).count,
  ).toBe(before.count);
  const ticket = randomToken();
  const native = await call("/api/auth/google/start?ticket=" + ticket, {
    environment,
  });
  expect(native.headers.get("location")).toBe(
    canonical + "/api/auth/google/start?ticket=" + ticket,
  );
});
