import {
  appleConfigured,
  appleClientSecret,
  verifyAppleIDToken,
  storeAppleGrant,
} from "./apple-provider.mjs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { hash } from "../server/db-core.mjs";
import { readLimited } from "./router.mjs";
export const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
};
export const challengeFor = async (verifier) =>
  Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  ).toString("base64url");
export const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers });
export const fail = (message, status = 400) =>
  Object.assign(Error(message), { status });
export const cookie = (req, name) =>
  req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1);
const sessionCookie = (token, secure = true) =>
  `rankwisp=${token}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? "; Secure" : ""}`;
const binderCookie = (value, secure = true) =>
  `rankwisp_oauth=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`;
const callbackURI = (env) =>
  env.GOOGLE_REDIRECT_URI || env.PUBLIC_ORIGIN + "/api/auth/google/callback";
export const googleConfigured = (env) =>
  Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.PUBLIC_ORIGIN &&
      callbackURI(env),
  );
export async function readJSON(request, max = 65536) {
  try {
    return JSON.parse(
      new TextDecoder().decode(await readLimited(request, max)) || "{}",
    );
  } catch (e) {
    throw fail(
      e.message === "PAYLOAD_TOO_LARGE" ? e.message : "INVALID_INPUT",
      e.message === "PAYLOAD_TOO_LARGE" ? 413 : 400,
    );
  }
}
export async function edgeRate(env, key, max, period = 60000) {
  const now = Date.now(),
    win = Math.floor(now / period);
  const row = await env.IDENTITY.prepare(
    "INSERT INTO edge_limits VALUES(?,?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window,updated=excluded.updated RETURNING count",
  )
    .bind(key, win, now)
    .first();
  return row.count <= max;
}
export async function sessionUser(request, env) {
  const raw =
    request.headers
      .get("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1] ||
    cookie(request, "rankwisp");
  if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const user = await env.IDENTITY.prepare(
    "SELECT u.*,s.created AS authenticated_at FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires>?",
  )
    .bind(hash(raw), Date.now())
    .first();
  return user ? { ...user, tokenHash: hash(raw) } : null;
}
async function makeSession(env, id) {
  const raw = randomToken(),
    now = Date.now();
  await env.IDENTITY.prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .bind(hash(raw), id, now, now + 7 * 86400000)
    .run();
  return raw;
}
export async function verifyGoogleIDToken(
  idToken,
  { clientId, nonce, keySet },
) {
  const keys =
    keySet ||
    createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), {
      timeoutDuration: 7000,
    });
  const { payload } = await jwtVerify(idToken, keys, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
    algorithms: ["RS256"],
    clockTolerance: 30,
    maxTokenAge: "10m",
  });
  if (
    payload.nonce !== nonce ||
    payload.email_verified !== true ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    payload.sub.startsWith("apple:") ||
    typeof payload.email !== "string" ||
    !payload.email.includes("@") ||
    payload.email.length > 254 ||
    (payload.azp && payload.azp !== clientId)
  )
    throw fail("GOOGLE_TOKEN_INVALID", 401);
  return { sub: payload.sub, email: payload.email.toLowerCase() };
}
export async function authRoute(request, env) {
  const provider = new URL(request.url).pathname.startsWith("/api/auth/apple/")
    ? "apple"
    : "google";
  const apple = provider === "apple";
  const prefix = provider.toUpperCase();
  const configured = apple ? appleConfigured(env) : googleConfigured(env);
  const clientId = apple ? env.APPLE_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  const redirectURI = apple
    ? env.APPLE_REDIRECT_URI || env.PUBLIC_ORIGIN + "/api/auth/apple/callback"
    : callbackURI(env);
  const stateTable = apple ? "apple_oauth_states" : "oauth_states";
  const nativeTable = apple ? "apple_native_auth" : "native_auth";
  const bindingCookie = (value, secure) =>
    apple
      ? `rankwisp_apple_oauth=${value}; Path=/api/auth/apple; HttpOnly; SameSite=None; Secure; Max-Age=600`
      : binderCookie(value, secure);
  const url = new URL(request.url),
    path = url.pathname,
    secure = new URL(env.PUBLIC_ORIGIN).protocol === "https:";
  if (
    path === `/api/auth/${provider}/native/start` &&
    request.method === "POST"
  ) {
    if (!configured) throw fail(prefix + "_NOT_CONFIGURED", 503);
    const body = await readJSON(request);
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(body.challenge) ||
      !["ios", "desktop"].includes(body.platform)
    )
      throw fail("INVALID_INPUT");
    const ticket = randomToken();
    await env.IDENTITY.prepare(
      `INSERT INTO ${nativeTable}(ticket_hash,challenge,platform,expires,handoff_ticket) VALUES(?,?,?,?,?)`,
    )
      .bind(
        hash(ticket),
        body.challenge,
        body.platform,
        Date.now() + 600000,
        ticket,
      )
      .run();
    return json({
      url: env.PUBLIC_ORIGIN + `/api/auth/${provider}/start?ticket=` + ticket,
      ticket,
      expiresIn: 600,
    });
  }
  if (
    path === `/api/auth/${provider}/native/exchange` &&
    request.method === "POST"
  ) {
    const { ticket, verifier, completionCode } = await readJSON(request);
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(ticket) ||
      typeof verifier !== "string" ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
    )
      throw fail("INVALID_INPUT");
    const challenge = await challengeFor(verifier),
      row = await env.IDENTITY.prepare(
        `SELECT * FROM ${nativeTable} WHERE ticket_hash=? AND expires>?`,
      )
        .bind(hash(ticket), Date.now())
        .first();
    if (!row || row.challenge !== challenge) throw fail("AUTH_EXPIRED", 401);
    if (row.status === "pending") return json({ status: "pending" }, 202);
    if (row.status !== "complete") {
      await env.IDENTITY.prepare(
        `DELETE FROM ${nativeTable} WHERE ticket_hash=?`,
      )
        .bind(hash(ticket))
        .run();
      throw fail(
        row.status === "cancelled"
          ? prefix + "_CANCELLED"
          : row.status === "link_required"
            ? "ACCOUNT_LINK_REQUIRED"
            : prefix + "_AUTH_FAILED",
        401,
      );
    }
    // Polling is deliberately insufficient: the completion secret is delivered only
    // to the browser's locally installed app through the custom-scheme fragment.
    if (completionCode === undefined) return json({ status: "pending" }, 202);
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(completionCode) ||
      !row.completion_hash ||
      hash(completionCode) !== row.completion_hash
    )
      throw fail("AUTH_COMPLETION_INVALID", 401);
    const consumed = await env.IDENTITY.prepare(
      `DELETE FROM ${nativeTable} WHERE ticket_hash=? AND challenge=? AND completion_hash=? AND status='complete' RETURNING user_id`,
    )
      .bind(hash(ticket), challenge, hash(completionCode))
      .first();
    if (!consumed) throw fail("AUTH_EXPIRED", 401);
    const user = await env.IDENTITY.prepare(
      "SELECT id,email FROM users WHERE id=?",
    )
      .bind(consumed.user_id)
      .first();
    if (!user) throw fail("AUTH_EXPIRED", 401);
    return json({ token: await makeSession(env, user.id), account: user });
  }
  if (path === `/api/auth/${provider}/start` && request.method === "GET") {
    // Bind state and the browser cookie on the same host as the registered callback.
    // Pages aliases must canonicalize before any OAuth state or cookie is created.
    if (url.origin !== new URL(env.PUBLIC_ORIGIN).origin) {
      const canonical = new URL(
        `/api/auth/${provider}/start`,
        env.PUBLIC_ORIGIN,
      );
      const ticket = url.searchParams.get("ticket");
      if (ticket) {
        if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) throw fail("INVALID_INPUT");
        canonical.searchParams.set("ticket", ticket);
      }
      return Response.redirect(canonical.href, 303);
    }
    if (!configured)
      return Response.redirect(
        env.PUBLIC_ORIGIN + "/app?authError=" + prefix + "_NOT_CONFIGURED",
        303,
      );
    let platform = "web",
      nativeTicket = null;
    const ticket = url.searchParams.get("ticket");
    if (ticket) {
      const row = await env.IDENTITY.prepare(
        `SELECT * FROM ${nativeTable} WHERE ticket_hash=? AND status='pending' AND expires>?`,
      )
        .bind(hash(ticket), Date.now())
        .first();
      if (!row) throw fail("AUTH_EXPIRED", 401);
      platform = row.platform;
      nativeTicket = hash(ticket);
    }
    const state = randomToken(),
      binder = randomToken(),
      nonce = randomToken(),
      verifier = randomToken();
    const returnTo = "/app";
    await env.IDENTITY.prepare(
      `INSERT INTO ${stateTable} VALUES(?,?,?,?,?,?,?,?)`,
    )
      .bind(
        hash(state),
        hash(binder),
        nonce,
        verifier,
        returnTo,
        nativeTicket,
        platform,
        Date.now() + 600000,
      )
      .run();
    const destination = new URL(
      apple
        ? "https://appleid.apple.com/auth/authorize"
        : "https://accounts.google.com/o/oauth2/v2/auth",
    );
    Object.entries({
      client_id: clientId,
      redirect_uri: redirectURI,
      response_type: "code",
      scope: apple ? "email" : "openid email profile",
      state,
      nonce,
      ...(apple
        ? { response_mode: "form_post" }
        : {
            code_challenge: await challengeFor(verifier),
            code_challenge_method: "S256",
            prompt: "select_account",
          }),
    }).forEach(([k, v]) => destination.searchParams.set(k, v));
    return new Response(null, {
      status: 302,
      headers: {
        Location: destination.href,
        "Set-Cookie": bindingCookie(binder, secure),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  if (
    path === `/api/auth/${provider}/callback` &&
    request.method === (apple ? "POST" : "GET")
  ) {
    const params = apple
      ? new URLSearchParams(
          new TextDecoder().decode(await readLimited(request, 16384)),
        )
      : url.searchParams;
    if (
      apple &&
      !request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      throw fail("INVALID_INPUT");
    if (["state", "code", "error"].some((key) => params.getAll(key).length > 1))
      throw fail("INVALID_INPUT");
    const state = params.get("state"),
      binder = cookie(
        request,
        apple ? "rankwisp_apple_oauth" : "rankwisp_oauth",
      );
    if (!state || !binder) throw fail("AUTH_STATE_INVALID", 401);
    const saved = await env.IDENTITY.prepare(
      `DELETE FROM ${stateTable} WHERE state_hash=? AND browser_hash=? AND expires>? RETURNING *`,
    )
      .bind(hash(state), hash(binder), Date.now())
      .first();
    if (!saved) throw fail("AUTH_STATE_INVALID", 401);
    let failure = null,
      user;
    try {
      if (params.has("error"))
        throw fail(
          ["access_denied", "user_cancelled_authorize"].includes(
            params.get("error"),
          )
            ? prefix + "_CANCELLED"
            : prefix + "_AUTH_FAILED",
          401,
        );
      const code = params.get("code");
      if (!code || code.length > 4000) throw fail(prefix + "_AUTH_FAILED", 401);
      const tokenResponse = await fetch(
        apple
          ? "https://appleid.apple.com/auth/token"
          : "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: apple
              ? await appleClientSecret(env)
              : env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectURI,
            grant_type: "authorization_code",
            ...(apple ? {} : { code_verifier: saved.verifier }),
          }),
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!tokenResponse.ok) throw fail(prefix + "_AUTH_FAILED", 401);
      const tokenData = await readJSON(tokenResponse, 65536);
      if (typeof tokenData.id_token !== "string")
        throw fail(prefix + "_AUTH_FAILED", 401);
      const identity = await (apple ? verifyAppleIDToken : verifyGoogleIDToken)(
        tokenData.id_token,
        {
          clientId,
          nonce: saved.nonce,
        },
      );
      // Legacy google_sub is retained to keep deployed Google versions compatible.
      // Apple subjects use a reserved namespace and never link accounts by email.
      const subjectKey = apple ? "apple:" + identity.sub : identity.sub;
      user = await env.IDENTITY.prepare(
        "SELECT * FROM users WHERE google_sub=?",
      )
        .bind(subjectKey)
        .first();
      if (!user) {
        const existing = await env.IDENTITY.prepare(
          "SELECT id FROM users WHERE email=?",
        )
          .bind(identity.email)
          .first();
        if (existing) throw fail("ACCOUNT_LINK_REQUIRED", 409);
        const id = crypto.randomUUID();
        await env.IDENTITY.prepare(
          "INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(google_sub) DO NOTHING",
        )
          .bind(id, subjectKey, identity.email, Date.now(), saved.platform)
          .run();
        user = await env.IDENTITY.prepare(
          "SELECT * FROM users WHERE google_sub=?",
        )
          .bind(subjectKey)
          .first();
      }
      if (apple) await storeAppleGrant(env, user.id, tokenData.refresh_token);
      await env.ACCOUNTS.getByName(user.id).initialize({
        id: user.id,
        email: user.email,
        created: user.created,
        platform: user.platform,
      });
    } catch (e) {
      failure = [prefix + "_CANCELLED", "ACCOUNT_LINK_REQUIRED"].includes(
        e.message,
      )
        ? e.message
        : prefix + "_AUTH_FAILED";
    }
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Set-Cookie": bindingCookie("", secure).replace(
        "Max-Age=600",
        "Max-Age=0",
      ),
    });
    if (saved.native_ticket) {
      const handoff = await env.IDENTITY.prepare(
        `SELECT handoff_ticket FROM ${nativeTable} WHERE ticket_hash=? AND expires>?`,
      )
        .bind(saved.native_ticket, Date.now())
        .first();
      if (
        !handoff?.handoff_ticket ||
        !/^[A-Za-z0-9_-]{43}$/.test(handoff.handoff_ticket)
      )
        failure = prefix + "_AUTH_FAILED";
      // Failure also needs a device-local return link: the app then displays the
      // provider cancellation/linking error instead of waiting for its timeout.
      const completionCode = /^[A-Za-z0-9_-]{43}$/.test(
        handoff?.handoff_ticket || "",
      )
        ? randomToken()
        : null;
      await env.IDENTITY.prepare(
        `UPDATE ${nativeTable} SET status=?,user_id=?,completion_hash=? WHERE ticket_hash=? AND expires>?`,
      )
        .bind(
          failure
            ? failure === prefix + "_CANCELLED"
              ? "cancelled"
              : failure === "ACCOUNT_LINK_REQUIRED"
                ? "link_required"
                : "failed"
            : "complete",
          user?.id || null,
          completionCode ? hash(completionCode) : null,
          saved.native_ticket,
          Date.now(),
        )
        .run();
      headers.set("Content-Type", "text/html; charset=utf-8");
      const message =
        failure === "ACCOUNT_LINK_REQUIRED"
          ? "This email already uses another sign-in provider. Return to Rankwisp and use your original sign-in method."
          : failure
            ? "Return to Rankwisp to continue or try again."
            : "Complete sign-in in the Rankwisp app on this device.";
      headers.set(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      );
      return new Response(
        `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Rankwisp sign-in</title><body style="background:#edf2f4;color:#2b2d42;font:18px system-ui;max-width:34rem;margin:18vh auto;padding:24px"><h1>${failure ? "Sign-in was not completed." : "You’re signed in."}</h1><p>${message}</p>${completionCode ? `<a style="display:inline-block;background:#2b2d42;color:#edf2f4;padding:14px 22px;border-radius:16px;text-decoration:none" href="rankwisp://auth/complete#ticket=${handoff.handoff_ticket}&amp;code=${completionCode}">Return to Rankwisp</a><p style="font-size:14px">Open the installed Rankwisp app. Do not copy or share this sign-in link.</p>` : ""}</body></html>`,
        { headers },
      );
    }
    if (failure) {
      headers.set(
        "Location",
        env.PUBLIC_ORIGIN + saved.return_to + "?authError=" + failure,
      );
      return new Response(null, { status: 303, headers });
    }
    headers.append(
      "Set-Cookie",
      sessionCookie(await makeSession(env, user.id), secure),
    );
    headers.set("Location", env.PUBLIC_ORIGIN + saved.return_to);
    return new Response(null, { status: 303, headers });
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    const user = await sessionUser(request, env);
    if (user)
      await env.IDENTITY.prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(user.tokenHash)
        .run();
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie("", secure).replace(
        "Max-Age=604800",
        "Max-Age=0",
      ),
    });
  }
  if (
    ["/api/auth/register", "/api/auth/login", "/api/auth/password"].includes(
      path,
    )
  )
    throw fail("GOOGLE_SIGN_IN_REQUIRED", 403);
  return null;
}
