import { beforeAll, beforeEach, afterEach, it, expect, vi } from "vitest";
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
import { hash } from "../../server/db-core.mjs";
const origin = "https://rankwisp.pages.dev";
let appleEnv, appleKey, appleJwk, clientPublic;
let testNetwork = 0;
beforeEach(() => {
  testNetwork += 1;
});
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
  worker.fetch(
    new Request(origin + path, {
      ...options,
      headers: {
        "cf-connecting-ip": `192.0.2.${testNetwork}`,
        ...options.headers,
      },
    }),
    environment,
  );
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
  environment = appleEnv,
) =>
  call(
    "/api/auth/apple/callback",
    {
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
    },
    environment,
  );
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
  expect(r.status).toBe(200);
  expect(await r.text()).toContain("Confirm existing Google account");
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
      start.cookie,
      "https://appleid.apple.com",
      reason === "link_required"
        ? { ...appleEnv, GOOGLE_CLIENT_SECRET: "" }
        : appleEnv,
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

async function existingGoogle() {
  const id = crypto.randomUUID(),
    sub = crypto.randomUUID(),
    session = randomToken();
  const email = `link-${id}@example.test`;
  await env.IDENTITY.prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .bind(id, sub, email, Date.now(), "web")
    .run();
  await env.IDENTITY.prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .bind(hash(session), id, Date.now(), Date.now() + 86400000)
    .run();
  await env.ACCOUNTS.getByName(id).initialize({
    id,
    email,
    created: Date.now(),
    platform: "web",
  });
  return { id, sub, email, session };
}
async function linkRequest(account, nativeTicket) {
  const start = await begin(nativeTicket);
  const sub = crypto.randomUUID();
  await mockProvider(start.nonce, { email: account.email, sub });
  const response = await callback(start);
  const html = await response.text();
  const request = html.match(/name="request" value="([A-Za-z0-9_-]{43})"/)[1];
  const binding = response.headers
    .getSetCookie()
    .find((c) => c.startsWith("rankwisp_apple_link="))
    .split(";")[0];
  return { request, binding, sub, nonce: start.nonce };
}
const confirmLink = (link, session, extra = {}) =>
  call("/api/auth/apple/link", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/x-www-form-urlencoded",
      cookie: `${link.binding}; rankwisp=${session}`,
      ...extra,
    },
    body: new URLSearchParams({ request: link.request, action: "link" }),
  });

it("linking requires bound browser, original recent Google session and explicit same-origin confirmation", async () => {
  const account = await existingGoogle(),
    other = await existingGoogle();
  const link = await linkRequest(account);
  expect((await confirmLink(link, "")).status).toBe(403);
  expect((await confirmLink(link, other.session)).status).toBe(403);
  expect(
    (
      await confirmLink(
        { ...link, binding: "rankwisp_apple_link=" + randomToken() },
        account.session,
      )
    ).status,
  ).toBe(401);
  expect(
    (await confirmLink(link, account.session, { origin: "https://evil.test" }))
      .status,
  ).toBe(403);
  await env.IDENTITY.prepare("UPDATE sessions SET created=? WHERE token_hash=?")
    .bind(Date.now() - 660000, hash(account.session))
    .run();
  expect((await confirmLink(link, account.session)).status).toBe(403);
  await env.IDENTITY.prepare("UPDATE sessions SET created=? WHERE token_hash=?")
    .bind(Date.now(), hash(account.session))
    .run();
  expect(
    await env.IDENTITY.prepare("SELECT * FROM apple_identities WHERE user_id=?")
      .bind(account.id)
      .first(),
  ).toBeNull();
  const stored = await env.IDENTITY.prepare(
    "SELECT grant_token FROM apple_link_requests WHERE request_hash=?",
  )
    .bind(hash(link.request))
    .first();
  expect(stored.grant_token).not.toContain("private-refresh");
  const result = await confirmLink(link, account.session);
  expect(result.status).toBe(303);
  const appleCookie = result.headers
    .getSetCookie()
    .find((c) => c.startsWith("rankwisp="))
    .split(";")[0];
  const me = await (
    await call("/api/me", { headers: { cookie: appleCookie } })
  ).json();
  expect(me.authProvider).toBe("apple");
  expect(me.account.id).toBe(account.id);
  expect((await confirmLink(link, account.session)).status).toBe(401);
  // Original Google session and account are preserved.
  expect(
    (
      await (
        await call("/api/me", {
          headers: { cookie: "rankwisp=" + account.session },
        })
      ).json()
    ).authProvider,
  ).toBe("google");
  // Deleting the linked Google-origin account must revoke its Apple grant too.
  const deletion = await call("/api/account", {
    method: "DELETE",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: appleCookie,
    },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  expect(deletion.status).toBe(200);
  expect(
    await env.IDENTITY.prepare("SELECT * FROM apple_identities WHERE user_id=?")
      .bind(account.id)
      .first(),
  ).toBeNull();
});

it("native Apple linking proves Google through OAuth, preserves account and returns through original device proof", async () => {
  const account = await existingGoogle(),
    verifier = randomToken();
  const pending = await (
    await call("/api/auth/apple/native/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        challenge: await challengeFor(verifier),
        platform: "desktop",
      }),
    })
  ).json();
  const link = await linkRequest(account, pending.ticket);
  const gs = await call("/api/auth/google/start?link=" + link.request, {
    headers: { cookie: link.binding },
  });
  expect(gs.status).toBe(302);
  const gu = new URL(gs.headers.get("location"));
  const googleKeys = await generateKeyPair("RS256");
  const gjwk = {
    ...(await exportJWK(googleKeys.publicKey)),
    alg: "RS256",
    kid: "google-link-test",
    use: "sig",
  };
  const gt = await new SignJWT({
    email: account.email,
    email_verified: true,
    nonce: gu.searchParams.get("nonce"),
  })
    .setProtectedHeader({ alg: "RS256", kid: gjwk.kid })
    .setIssuer("https://accounts.google.com")
    .setAudience(appleEnv.GOOGLE_CLIENT_ID)
    .setSubject(account.sub)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(googleKeys.privateKey);
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input) === "https://www.googleapis.com/oauth2/v3/certs")
      return Response.json({ keys: [gjwk] });
    if (String(input) === "https://oauth2.googleapis.com/token")
      return Response.json({ id_token: gt });
    throw Error("Unexpected provider request");
  });
  const gr = await call(
    "/api/auth/google/callback?state=" +
      gu.searchParams.get("state") +
      "&code=test",
    {
      headers: {
        cookie:
          gs.headers.get("set-cookie").split(";")[0] + "; " + link.binding,
      },
    },
  );
  expect(gr.status).toBe(303);
  expect(gr.headers.get("location")).toBe(
    origin + "/api/auth/apple/link?request=" + link.request,
  );
  const session = gr.headers
    .getSetCookie()
    .find((c) => c.startsWith("rankwisp="))
    .split(";")[0]
    .slice("rankwisp=".length);
  const confirmPage = await call(
    "/api/auth/apple/link?request=" + link.request,
    { headers: { cookie: link.binding + "; rankwisp=" + session } },
  );
  expect(await confirmPage.text()).toContain("Link Apple and continue");
  const done = await confirmLink(link, session);
  const html = await done.text();
  expect(html).toContain("You’re signed in.");
  const completionCode = html.match(/&amp;code=([A-Za-z0-9_-]{43})/)[1];
  const exchange = (body) =>
    call("/api/auth/apple/native/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect((await exchange({ ticket: pending.ticket, verifier })).status).toBe(
    202,
  );
  const native = await exchange({
    ticket: pending.ticket,
    verifier,
    completionCode,
  });
  const { token: sessionToken } = await native.json();
  const me = await (
    await call("/api/me", {
      headers: { authorization: "Bearer " + sessionToken },
    })
  ).json();
  expect(me.account.id).toBe(account.id);
  expect(me.authProvider).toBe("apple");
  expect(
    (await exchange({ ticket: pending.ticket, verifier, completionCode }))
      .status,
  ).toBe(401);
  // Subsequent Apple login resolves the linked identity without an email merge.
  vi.restoreAllMocks();
  const again = await begin();
  await mockProvider(again.nonce, { sub: link.sub, email: account.email });
  const restored = await callback(again);
  expect(restored.headers.get("location")).toBe(origin + "/app");
});

it("link requests expire and cancellation creates no identity", async () => {
  const account = await existingGoogle();
  let link = await linkRequest(account);
  await env.IDENTITY.prepare(
    "UPDATE apple_link_requests SET expires=0 WHERE request_hash=?",
  )
    .bind(hash(link.request))
    .run();
  expect((await confirmLink(link, account.session)).status).toBe(401);
  vi.restoreAllMocks();
  link = await linkRequest(account);
  const r = await call("/api/auth/apple/link", {
    method: "POST",
    headers: {
      origin,
      cookie: link.binding,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ request: link.request, action: "cancel" }),
  });
  expect(r.headers.get("location")).toContain("APPLE_CANCELLED");
  expect(
    await env.IDENTITY.prepare("SELECT * FROM apple_identities WHERE user_id=?")
      .bind(account.id)
      .first(),
  ).toBeNull();
});
