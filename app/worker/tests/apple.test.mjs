import { beforeAll, afterEach, it, expect, vi } from "vitest";
import { env } from "cloudflare:workers";
import {
  generateKeyPair,
  exportPKCS8,
  exportJWK,
  SignJWT,
  jwtVerify,
  createLocalJWKSet,
} from "jose";
import worker from "../index.mjs";
import { verifyAppleIDToken } from "../apple-provider.mjs";
import { randomToken, challengeFor } from "../auth.mjs";
const origin = "https://rankwisp.pages.dev";
let appleEnv, appleKey, appleJwk, clientPublic;
beforeAll(async () => {
  const client = await generateKeyPair("ES256", { extractable: true });
  clientPublic = client.publicKey;
  appleKey = await generateKeyPair("RS256");
  appleJwk = {
    ...(await exportJWK(appleKey.publicKey)),
    alg: "RS256",
    use: "sig",
    kid: "apple-test",
  };
  appleEnv = {
    ...env,
    APPLE_CLIENT_ID: "ch.zhstudio.rankwisp.web",
    APPLE_TEAM_ID: "TESTTEAM01",
    APPLE_KEY_ID: "TESTKEY001",
    APPLE_REDIRECT_URI: origin + "/api/auth/apple/callback",
    APPLE_PRIVATE_KEY: await exportPKCS8(client.privateKey),
    APPLE_TOKEN_ENCRYPTION_KEY: Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString("base64"),
  };
});
afterEach(() => vi.restoreAllMocks());
const call = (path, options = {}, environment = appleEnv) =>
  worker.fetch(new Request(origin + path, options), environment);
async function begin(ticket) {
  const r = await call(
    "/api/auth/apple/start" + (ticket ? "?ticket=" + ticket : ""),
  );
  expect(r.status).toBe(302);
  const url = new URL(r.headers.get("location"));
  return {
    response: r,
    url,
    state: url.searchParams.get("state"),
    nonce: url.searchParams.get("nonce"),
    cookie: r.headers.get("set-cookie").split(";")[0],
  };
}
async function token(
  nonce,
  overrides = {},
  issuer = "https://appleid.apple.com",
  audience = appleEnv.APPLE_CLIENT_ID,
) {
  return new SignJWT({
    email: "apple-" + crypto.randomUUID() + "@privaterelay.appleid.com",
    email_verified: "true",
    nonce,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "apple-test" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(overrides.sub || crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(appleKey.privateKey);
}
async function mockProvider(nonce, overrides = {}) {
  const idToken = await token(nonce, overrides);
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, options) => {
      if (String(input) === "https://appleid.apple.com/auth/keys")
        return Response.json({ keys: [appleJwk] });
      const form = new URLSearchParams(options?.body);
      if (String(input) === "https://appleid.apple.com/auth/token") {
        const secret = await jwtVerify(
          form.get("client_secret"),
          clientPublic,
          {
            algorithms: ["ES256"],
            issuer: appleEnv.APPLE_TEAM_ID,
            audience: "https://appleid.apple.com",
          },
        );
        expect(secret.payload.sub).toBe(appleEnv.APPLE_CLIENT_ID);
        expect(form.get("code_verifier")).toBeNull();
        expect(form.get("redirect_uri")).toBe(
          origin + "/api/auth/apple/callback",
        );
        return Response.json({
          id_token: idToken,
          refresh_token: "private-refresh-" + nonce,
        });
      }
      if (String(input) === "https://appleid.apple.com/auth/revoke") {
        expect(form.get("token")).toBe("private-refresh-" + nonce);
        expect(form.get("token_type_hint")).toBe("refresh_token");
        return new Response(null, { status: 200 });
      }
      throw Error("Unexpected provider request");
    });
}
const callback = (
  start,
  values = {},
  cookie = start.cookie,
  requestOrigin = "https://appleid.apple.com",
) =>
  call("/api/auth/apple/callback", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie,
      origin: requestOrigin,
    },
    body: new URLSearchParams({
      state: start.state,
      code: "apple-code",
      ...values,
    }),
  });
it("Apple availability fails closed; authorization uses a separate POST binding and canonical callback", async () => {
  const disabled = await call(
    "/api/config",
    {},
    { ...appleEnv, APPLE_PRIVATE_KEY: "" },
  );
  expect((await disabled.json()).appleConfigured).toBe(false);
  expect((await call("/api/config")).status).toBe(200);
  const start = await begin();
  expect(start.url.origin).toBe("https://appleid.apple.com");
  expect(start.url.searchParams.get("redirect_uri")).toBe(
    origin + "/api/auth/apple/callback",
  );
  expect(start.url.searchParams.get("response_mode")).toBe("form_post");
  expect(start.url.searchParams.get("scope")).toBe("email");
  expect(start.response.headers.get("set-cookie")).toContain(
    "SameSite=None; Secure",
  );
  expect(start.cookie).toMatch(/^rankwisp_apple_oauth=/);
  expect(
    (await callback(start, {}, start.cookie, "https://evil.test")).status,
  ).toBe(403);
  expect(
    (
      await call("/api/workspace", {
        headers: { origin: "https://appleid.apple.com" },
      })
    ).status,
  ).toBe(403);
});
it("Apple ID tokens require signed issuer, audience, nonce and verified email including relay addresses", async () => {
  const nonce = randomToken(),
    keySet = createLocalJWKSet({ keys: [appleJwk] });
  const verify = (value) =>
    verifyAppleIDToken(value, {
      clientId: appleEnv.APPLE_CLIENT_ID,
      nonce,
      keySet,
    });
  expect((await verify(await token(nonce))).email).toContain(
    "@privaterelay.appleid.com",
  );
  for (const value of [
    await token("wrong"),
    await token(nonce, { email_verified: false }),
    await token(nonce, {}, "https://evil.test"),
    await token(nonce, {}, "https://appleid.apple.com", "wrong-client"),
  ])
    await expect(verify(value)).rejects.toThrow();
});
it("Apple POST callback establishes and restores a session, encrypts grant, rejects replay and revokes on deletion", async () => {
  const start = await begin();
  const provider = await mockProvider(start.nonce);
  expect((await callback(start, {}, "rankwisp_apple_oauth=wrong")).status).toBe(
    401,
  );
  const complete = await callback(start);
  expect(complete.status).toBe(303);
  expect(complete.headers.get("location")).toBe(origin + "/app");
  expect(complete.headers.has("access-control-allow-origin")).toBe(false);
  const session = complete.headers
    .getSetCookie()
    .find((c) => c.startsWith("rankwisp="));
  expect(session).toContain("HttpOnly");
  const cookie = session.split(";")[0];
  const me = await (await call("/api/me", { headers: { cookie } })).json();
  expect(me.authProvider).toBe("apple");
  const grant = await env.IDENTITY.prepare(
    "SELECT token FROM apple_grants WHERE user_id=?",
  )
    .bind(me.account.id)
    .first();
  expect(grant.token).not.toContain("private-refresh");
  expect((await callback(start)).status).toBe(401);
  expect(
    (
      await call("/api/account", {
        method: "DELETE",
        headers: { cookie, origin, "content-type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      })
    ).status,
  ).toBe(200);
  expect(
    provider.mock.calls.some(([url]) => String(url).endsWith("/auth/revoke")),
  ).toBe(true);
  expect((await call("/api/me", { headers: { cookie } })).status).toBe(401);
});
it("Apple native login cannot be exchanged through Google, by polling, or without device proof", async () => {
  const verifier = randomToken(),
    challenge = await challengeFor(verifier);
  const post = (path, body) =>
    call(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const pending = await (
    await post("/api/auth/apple/native/start", {
      challenge,
      platform: "desktop",
    })
  ).json();
  expect(pending.url).toBe(
    origin + "/api/auth/apple/start?ticket=" + pending.ticket,
  );
  expect(
    (
      await post("/api/auth/google/native/exchange", {
        ticket: pending.ticket,
        verifier,
      })
    ).status,
  ).toBe(401);
  const start = await begin(pending.ticket);
  await mockProvider(start.nonce);
  const complete = await callback(start);
  const html = await complete.text();
  const code = html.match(/&amp;code=([A-Za-z0-9_-]{43})/)[1];
  expect(
    (
      await post("/api/auth/apple/native/exchange", {
        ticket: pending.ticket,
        verifier,
      })
    ).status,
  ).toBe(202);
  expect(
    (
      await post("/api/auth/apple/native/exchange", {
        ticket: pending.ticket,
        verifier: randomToken(),
        completionCode: code,
      })
    ).status,
  ).toBe(401);
  const exchange = await post("/api/auth/apple/native/exchange", {
    ticket: pending.ticket,
    verifier,
    completionCode: code,
  });
  expect(exchange.status).toBe(200);
  const { token } = await exchange.json();
  expect(
    (
      await (
        await call("/api/me", { headers: { authorization: "Bearer " + token } })
      ).json()
    ).authProvider,
  ).toBe("apple");
  expect(
    (
      await post("/api/auth/apple/native/exchange", {
        ticket: pending.ticket,
        verifier,
        completionCode: code,
      })
    ).status,
  ).toBe(401);
  await call("/api/auth/logout", {
    method: "POST",
    headers: { authorization: "Bearer " + token },
  });
  expect(
    (await call("/api/me", { headers: { authorization: "Bearer " + token } }))
      .status,
  ).toBe(401);
});
it("Apple cancellation creates no account and matching Google email does not merge identities", async () => {
  let start = await begin();
  let r = await callback(start, { error: "user_cancelled_authorize" });
  expect(r.headers.get("location")).toContain("APPLE_CANCELLED");
  start = await begin();
  const email = "existing-" + crypto.randomUUID() + "@example.test";
  await env.IDENTITY.prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .bind(crypto.randomUUID(), crypto.randomUUID(), email, Date.now(), "web")
    .run();
  await mockProvider(start.nonce, { email });
  r = await callback(start);
  expect(r.headers.get("location")).toContain("ACCOUNT_LINK_REQUIRED");
  expect(r.headers.getSetCookie().some((c) => c.startsWith("rankwisp="))).toBe(
    false,
  );
});

it.each(["cancelled", "link_required"])(
  "native Apple %s returns to the originating device without a session",
  async (reason) => {
    const verifier = randomToken();
    const post = (path, body) =>
      call(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const pending = await (
      await post("/api/auth/apple/native/start", {
        challenge: await challengeFor(verifier),
        platform: "desktop",
      })
    ).json();
    const start = await begin(pending.ticket);
    if (reason === "link_required") {
      const email = "collision-" + crypto.randomUUID() + "@example.test";
      await env.IDENTITY.prepare("INSERT INTO users VALUES(?,?,?,?,?)")
        .bind(
          crypto.randomUUID(),
          crypto.randomUUID(),
          email,
          Date.now(),
          "web",
        )
        .run();
      await mockProvider(start.nonce, { email });
    }
    const response = await callback(
      start,
      reason === "cancelled"
        ? { error: "user_cancelled_authorize" }
        : undefined,
    );
    const html = await response.text();
    const code = html.match(/&amp;code=([A-Za-z0-9_-]{43})/)[1];
    expect(html).toContain("Return to Rankwisp");
    expect(html).not.toContain("You’re signed in.");
    const result = await post("/api/auth/apple/native/exchange", {
      ticket: pending.ticket,
      verifier,
      completionCode: code,
    });
    expect(result.status).toBe(401);
    expect(await result.json()).toEqual({
      error:
        reason === "cancelled" ? "APPLE_CANCELLED" : "ACCOUNT_LINK_REQUIRED",
    });
    expect(
      (
        await post("/api/auth/apple/native/exchange", {
          ticket: pending.ticket,
          verifier,
          completionCode: code,
        })
      ).status,
    ).toBe(401);
  },
);
