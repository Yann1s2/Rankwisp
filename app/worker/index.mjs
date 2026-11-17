import {
  authRoute,
  googleConfigured,
  sessionUser,
  edgeRate,
  json,
  fail,
  readJSON,
} from "./auth.mjs";
import { hash } from "../server/db-core.mjs";
import { readLimited } from "./router.mjs";
import { billingWebhook } from "./billing.mjs";
import { appleConfigured, revokeAppleGrant } from "./apple-provider.mjs";
export { AccountStore } from "./account.mjs";
export { ServiceCoordinator } from "./coordinator.mjs";
function configured(env) {
  return (
    typeof env.PUBLIC_ORIGIN === "string" &&
    (/^https:\/\//.test(env.PUBLIC_ORIGIN) || env.NODE_ENV !== "production")
  );
}
function cors(request, env) {
  const appleCallback =
    request.method === "POST" &&
    new URL(request.url).pathname === "/api/auth/apple/callback";
  const allowed = new Set(
    [env.PUBLIC_ORIGIN, ...(env.ALLOWED_ORIGINS || "").split(",")].filter(
      Boolean,
    ),
  );
  const origin = request.headers.get("origin");
  if (
    origin &&
    !allowed.has(origin) &&
    !(appleCallback && origin === "https://appleid.apple.com") &&
    !(
      env.PREVIEW_PAGES_PROJECT &&
      /^[a-z0-9-]+$/.test(env.PREVIEW_PAGES_PROJECT) &&
      new RegExp(
        "^https://[a-z0-9-]+\\." +
          env.PREVIEW_PAGES_PROJECT +
          "\\.pages\\.dev$",
      ).test(origin)
    )
  )
    throw fail("ORIGIN_REJECTED", 403);
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "X-Frame-Options": "DENY",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  };
  if (env.NODE_ENV === "production")
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains";
  if (origin && !appleCallback) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers.Vary = "Origin";
    headers["Access-Control-Allow-Headers"] =
      "Content-Type,Authorization,X-Rankwisp-Client";
    headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS";
  }
  return headers;
}
export default {
  async fetch(request, env) {
    let headers = {};
    try {
      if (!configured(env)) throw fail("SERVER_CONFIGURATION", 503);
      headers = cors(request, env);
      if (request.method === "OPTIONS")
        return new Response(null, { status: 204, headers });
      const url = new URL(request.url),
        path = url.pathname;
      if (!path.startsWith("/api/")) throw fail("NOT_FOUND", 404);
      // CF supplies this header; callers cannot select another rate-limit identity.
      const ip = hash(request.headers.get("cf-connecting-ip") || "local");
      if (!(await edgeRate(env, "ip:" + ip, 240)))
        throw fail("RATE_LIMIT", 429);
      if (
        /^\/api\/auth\/(google|apple)\//.test(path) &&
        !path.endsWith("/exchange") &&
        !(await edgeRate(env, "oauth:" + ip, 20))
      )
        throw fail("RATE_LIMIT", 429);
      if (
        ["POST", "PATCH", "DELETE", "PUT"].includes(request.method) &&
        !path.startsWith("/api/webhooks/")
      ) {
        const bearer = /^Bearer [A-Za-z0-9_-]{43}$/.test(
          request.headers.get("authorization") || "",
        );
        const nativeStart =
          /^\/api\/auth\/(google|apple)\/native\/(start|exchange)$/.test(path);
        const appleCallback =
          path === "/api/auth/apple/callback" && request.method === "POST";
        if (
          !request.headers.has("origin") &&
          !bearer &&
          !nativeStart &&
          !appleCallback
        )
          throw fail("ORIGIN_REQUIRED", 403);
        const bytes = await readLimited(
          request,
          appleCallback ? 16384 : 25165824,
        );
        request = new Request(request, { body: bytes });
      }
      let response;
      if (path === "/api/health")
        response = json({
          ok: true,
          product: "Rankwisp",
          mode: env.NODE_ENV === "production" ? "production" : "development",
          runtime: "cloudflare-workers",
        });
      else if (path === "/api/config")
        response = json({
          localPreview: env.NODE_ENV !== "production",
          registrationOpen: false,
          googleConfigured: googleConfigured(env),
          appleConfigured: appleConfigured(env),
          authProvider: "google",
          aiConfigured: !!env.OPENAI_API_KEY,
          paymentsConfigured:
            !!env.STRIPE_SECRET_KEY &&
            !!env.STRIPE_PRICE_ID &&
            env.LEGAL_APPROVED === "true",
          applePaymentsConfigured:
            !!env.APPLE_ROOT_CERTS_BASE64 &&
            !!env.APPLE_APP_ID &&
            env.LEGAL_APPROVED === "true",
          support: "info@zhstudio.ch",
        });
      else if (path.startsWith("/api/webhooks/")) {
        if (request.method !== "POST") throw fail("METHOD_NOT_ALLOWED", 405);
        response = await billingWebhook(request, env);
      } else if (path.startsWith("/api/auth/"))
        response = await authRoute(request, env);
      if (!response) {
        const user = await sessionUser(request, env);
        if (!user) throw fail("SIGN_IN_REQUIRED", 401);
        if (path === "/api/account" && request.method === "DELETE") {
          const body = await readJSON(request);
          if (Date.now() - user.authenticated_at > 600000)
            throw fail("REAUTH_REQUIRED", 403);
          if (body.confirm !== "DELETE") throw fail("CONFIRMATION_REQUIRED");
          if (user.google_sub.startsWith("apple:"))
            await revokeAppleGrant(env, user.id);
          // Revoke all sessions first: concurrent requests cannot revive the deleted identity.
          await env.IDENTITY.prepare("DELETE FROM sessions WHERE user_id=?")
            .bind(user.id)
            .run();
          await env.ACCOUNTS.getByName(user.id).deleteAccount();
          await env.IDENTITY.prepare("DELETE FROM users WHERE id=?")
            .bind(user.id)
            .run();
          response = json({ ok: true }, 200, {
            "Set-Cookie":
              "rankwisp=; Path=/api; HttpOnly; SameSite=Lax; Secure; Max-Age=0",
          });
        } else
          response = await env.ACCOUNTS.getByName(user.id).handle(request, {
            id: user.id,
            authenticated_at: user.authenticated_at,
            authProvider: user.google_sub.startsWith("apple:")
              ? "apple"
              : "google",
            ip,
          });
      }
      const merged = new Headers(response.headers);
      for (const [k, v] of Object.entries(headers))
        if (!merged.has(k) || k.startsWith("Access-Control")) merged.set(k, v);
      return new Response(response.body, {
        status: response.status,
        headers: merged,
      });
    } catch (error) {
      const status = error.status || 502;
      const code = /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "SERVICE_UNAVAILABLE";
      if (status >= 500)
        console.error(
          JSON.stringify({ event: "request_failed", code, status }),
        );
      return json({ error: code }, status, headers);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const now = Date.now();
        await env.IDENTITY.batch([
          env.IDENTITY.prepare("DELETE FROM sessions WHERE expires<?").bind(
            now,
          ),
          env.IDENTITY.prepare("DELETE FROM oauth_states WHERE expires<?").bind(
            now,
          ),
          env.IDENTITY.prepare("DELETE FROM native_auth WHERE expires<?").bind(
            now,
          ),
          env.IDENTITY.prepare(
            "DELETE FROM apple_oauth_states WHERE expires<?",
          ).bind(now),
          env.IDENTITY.prepare(
            "DELETE FROM apple_native_auth WHERE expires<?",
          ).bind(now),
          env.IDENTITY.prepare("DELETE FROM edge_limits WHERE updated<?").bind(
            now - 86400000,
          ),
        ]);
        await env.COORDINATOR.getByName("provider-coordination").cleanup();
      })(),
    );
  },
};
