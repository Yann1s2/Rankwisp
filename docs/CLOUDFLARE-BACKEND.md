# Cloudflare backend and Google sign-in

## Architecture

`app/worker/index.mjs` is the Cloudflare Workers entry point. The existing domain and
API handlers remain shared with the local Node server; no filesystem database is bundled
into the Worker. A small Request/Response router adapts those handlers to Workers.

- **D1 `IDENTITY`** stores Google subject-to-account mappings, hashed seven-day sessions,
  short-lived OAuth state, native handoff tickets and edge rate counters.
- **One SQLite Durable Object per account** owns workspace/history, imports and recovery
  snapshots, trial/licence, local quotas, preferences and durable refresh jobs. There is
  no shared mutable current-account state. Mutations and import replacement use synchronous
  SQLite transactions. Large JSON documents are split into bounded rows without changing
  the export format. Unicode surrogate pairs are preserved at chunk boundaries.
- **A coordinator Durable Object** handles only cross-account Apple request pacing/cache
  and the global conservative AI spending reservation. Ordinary account reads/mutations
  do not pass through this object.
- **No KV or R2** is required for this implementation. Strongly consistent revocation and
  budgets must not depend on eventually consistent KV. The current payloads fit chunked
  per-account SQLite; huge historical datasets would benefit from normalized/paginated
  observations before adding object storage.
- **Pages `/api/*` service binding** forwards browser requests to the Worker under the same
  origin. Native clients use the configured HTTPS Pages origin. No secret is in the client.

Production and branch previews must use separate Worker names, D1 databases and Durable
Object namespaces. Preview origins are allowed only when `PREVIEW_PAGES_PROJECT` is set;
production does not allow arbitrary preview origins. Scheduled cleanup expires sessions,
OAuth handoffs, rate counters and caches. Account alarms process one keyword at a time,
so a 50-keyword refresh does not rely on one long-lived HTTP request.

## Data capacity and preservation

A compact workspace is limited to **16 MiB** to bound Worker memory usage. `/api/me`
returns `storage.bytes` and `storage.limitBytes`. Oversize writes return HTTP 413
`WORKSPACE_STORAGE_LIMIT` before replacing data. Nothing is truncated; existing history
and exports remain readable. This capacity limit can be reached before the check quota
when result sets or imported fields are large. Request bodies allow 24 MiB so an exported
workspace at the capacity limit can be restored. The frontend allows larger formatted
JSON files because whitespace is removed when sending parsed JSON.

Import preview and compare-and-swap remain mandatory. Both the original uploaded object
and the previous workspace are retained transactionally, in chunked rows. Automatic
updates are paused on import. Queued measurements retain app/country/keyword identity;
changed or removed inputs cannot receive old observations after an import.

The existing local SQLite database is **not uploaded automatically**. A user signs into
Google, exports their old workspace and imports it through the preview. Legacy local
password credentials and trial/payment entitlement are not silently converted into
verified Google ownership. Merchant entitlements require an explicit verified migration
or the existing signed restore flow.

## Google Cloud Console setup still required

No Google OAuth client secret is committed. The implemented flow requires an actual
Google Cloud project and a **Web application** OAuth client:

1. Configure Google Auth Platform branding/consent: Rankwisp, support `info@zhstudio.ch`,
   the actual verified application domain, production privacy policy and terms URLs.
   Add test users while the consent screen is in Testing mode.
2. Request only `openid email profile`. No offline access or Google API scopes are used.
3. Set the exact authorized redirect URI to
   `https://rankwisp.pages.dev/api/auth/google/callback` (replace the origin if the deployed
   Pages address differs). No wildcard redirect URIs. The native apps deliberately use
   this same server callback through the system browser.
4. If Google requests an authorized JavaScript origin, use the exact HTTPS Pages origin.
   This implementation uses the server authorization-code flow, not an embedded Google
   credential form or an iframe.
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_REDIRECT_URI` as Worker variables and put
   `GOOGLE_CLIENT_SECRET` into Wrangler secrets. Never use a `VITE_` variable for the secret.
   Use a separate OAuth client and test users for the canonical preview origin.
6. Perform a live Google login, account selection, cancellation, logout, restart/session
   restoration and native handoff test. The local suite uses signed mock-provider tokens;
   it does not prove consent-screen publication, domain ownership or a real Google account.

```sh
cd app
npx wrangler secret put GOOGLE_CLIENT_SECRET --config worker/wrangler.jsonc
# Preview must receive its own secret, if enabled:
npx wrangler secret put GOOGLE_CLIENT_SECRET --config worker/wrangler.jsonc --env preview
```

If credentials are absent, `/api/config` returns `googleConfigured:false`; a real Google
login is not claimed. No fake success, development bypass account or test token endpoint
is deployed.

## Authentication protocol

Web: `GET /api/auth/google/start` first redirects aliases to `PUBLIC_ORIGIN`, before
creating any browser cookie or OAuth state. This keeps the binding cookie on the same
host as the registered callback when a custom domain is added. It then creates a random
state, nonce, PKCE verifier and
HttpOnly browser-binding cookie. D1 retains only the state hash and browser-cookie hash,
with a ten-minute expiry. The callback atomically consumes the matching state, exchanges
the code at Google's token endpoint and verifies RS256 signature via Google's JWKS,
issuer, audience/authorized party, expiry/issued-at age, nonce and verified email. Google's
`sub` is the account identity; matching an email alone never silently links an account.
Provider access/refresh/ID tokens are not persisted. Successful sign-in issues a random
HttpOnly, Secure, SameSite=Lax session cookie; only its hash is stored in D1. Unsafe
browser requests require an allowed Origin; native authenticated requests use bearer
sessions. Logout deletes the server session. Google account deletion requires a session
created by a recent sign-in (ten minutes) and `confirm:"DELETE"`.

Native:

1. Client generates a random verifier and SHA-256 base64url challenge.
2. `POST /api/auth/google/native/start` with `{challenge, platform:"ios"|"desktop"}`
   returns `{url,ticket,expiresIn:600}`. Open `url` in the system browser.
3. Poll `POST /api/auth/google/native/exchange` with `{ticket,verifier}`. HTTP 202 means
   pending; HTTP 200 contains `{token,account}`. A wrong verifier cannot consume a valid
   ticket. Successful exchange consumes it once and issues a separate bearer session.
4. Store the token in the native OS secure store. Cancellation/errors expire or terminate
   the handoff; credentials are never returned in a custom URL scheme or browser URL.

`POST /api/projects/:id/refresh` returns HTTP 202 with `{jobId,status,total,completed,errors}`.
Poll `GET /api/jobs/:jobId` until completed. Jobs and remaining keyword inputs survive
Worker eviction. The frontend can continue reading workspace progress while the alarm
works. Explicit enqueue rate limits do not accidentally throttle the internal six-plus
keyword processing loop.

## Commerce and AI

The existing legal enable flag still gates checkout. Stripe webhooks use exact raw-body
signature validation and verify the configured one-time SKU. Full refunds revoke; partial
refunds do not revoke the entire licence. Open disputes suspend entitlement; only a signed
won-dispute closure can restore it. A delayed generic checkout success cannot clear an
open dispute or resurrect a full refund. Apple verification uses official root certificates
provided as `APPLE_ROOT_CERTS_BASE64`, a JSON array of base64 DER certificate contents.
Bundle/environment/app/product IDs must match the configured StoreKit products. Signed
Apple account tokens bind transactions to the account. Trial revocation notifications are
processed as well as paid-product notifications. The Apple SDK’s online certificate/OCSP
verification path must still be exercised with a real StoreKit sandbox transaction on
the deployed Worker; building the bundle does not prove that external validation path.

Luna and optional stronger-model requests remain server-only, with explicit consent,
bounded evidence and response size, per-account and global conservative reservations.
Imported arbitrary passthrough fields are not forwarded to the model. Reservations are
not refunded on uncertain provider failures, and requests are not automatically retried.
No real model or merchant credentials were assumed available.

## Commands and evidence

```sh
cd app
npx wrangler d1 migrations apply rankwisp-identity --config worker/wrangler.jsonc --remote
npx vitest run --config worker/vitest.config.mjs
node worker/scripts/startup-smoke.mjs
# Explicit real Apple network test, kept out of deterministic CI:
npx vitest run --config worker/vitest.live.config.mjs
npm test
npx wrangler types --config worker/wrangler.jsonc worker/worker-configuration.d.ts
npx wrangler deploy --config worker/wrangler.jsonc --dry-run
```

The workerd suite uses actual local D1 and Durable Objects. It covers OAuth state/nonce/
PKCE, a complete signed mocked-provider callback and session, replay/cancellation,
malicious origins, tenant isolation, import/recovery/export, expiry, durable six-keyword
jobs, global reservation races, dispute ordering, account deletion and large Unicode
storage round trips. Root release documentation records actual remote deployment results
and final test counts. Live Google/Stripe/StoreKit configuration-dependent tests remain
separate release gates.

References: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect),
[Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/),
[Durable Object SQLite transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[Cloudflare storage limits](https://developers.cloudflare.com/durable-objects/platform/limits/).

## Deployment verification — 17 November 2026

Both actual deployments succeeded after correcting a Worker startup failure: the Apple
SDK transitively initializes random values at import time. Its import now occurs lazily
inside authenticated billing/notification handlers, never at Worker global evaluation.
The bundled `wrangler dev` smoke test starts real workerd with local D1 and verifies health;
it complements the Vitest suite, whose transformed module context did not catch that error.

- Production: `https://rankwisp-api.yannis-66678.workers.dev`, version
  `a0183342-dad7-4d7b-b85f-a6c8d7194ab2`.
- Preview: `https://rankwisp-api-preview.yannis-66678.workers.dev`, version
  `4266bbe5-41fe-4410-9c3a-c3fcbe2ea814`.
- Actual HTTPS health/config returned 200 in both; production rejects hostile and branch
  origins with 403, preview accepts the exact project branch pattern, unauthenticated
  workspace returns 401. Google/AI/payment availability correctly remains false.
- A separate **real external Apple test** passed through local workerd, actual local D1
  and account/coordinator Durable Objects: public US Things 3 search, ID 904237743 lookup,
  project creation, durable refresh alarm, persisted positive rank and Apple HTTP/source
  provenance. This test injects only a synthetic local identity/session, not Apple replies;
  it creates no production bypass or account. It does not test Google live credentials.

Full production Google consent verification may require an owned custom domain with
verifiable policy pages. Do not represent the shared `pages.dev` parent domain as owned;
use the exact deployed redirect for testing and migrate the configured callback to the
verified custom domain when completing Google branding/verification.
