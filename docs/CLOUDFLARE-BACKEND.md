# Cloudflare backend and social sign-in

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

## Google Cloud Console setup

Production Google sign-in is configured and was exercised with a real account on 17 November 2026, in the browser and packaged macOS app. The consent screen is published. Preview remains unconfigured. No Google OAuth client secret is committed. Self-hosting requires an actual
Google Cloud project and a **Web application** OAuth client:

1. Configure Google Auth Platform branding/consent: Rankwisp, support `info@zhstudio.ch`,
   the actual verified application domain, production privacy policy and terms URLs.
   Add test users while the consent screen is in Testing mode.
2. Request only `openid email profile`. No offline access or Google API scopes are used.
3. Set the exact authorized redirect URI to
   `https://rank.zhstudio.ch/api/auth/google/callback` (the canonical production origin). No wildcard redirect URIs. The native apps deliberately use
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

## Sign in with Apple

The web/native implementation and signed-provider tests are complete. Production Apple
identifiers and a dedicated Sign in with Apple key were registered with the owner's
approval on 17 November 2026. The private key and grant-encryption key are stored as
Cloudflare secrets, outside source control. `/api/config` returns `appleConfigured:true`.
The packaged macOS app completed a real Hide My Email login, native return, full
quit/reopen session restoration, logout and a second successful login. Browser-only and real account-linking
flows remain separate manual checks; signed-provider tests cover both.

Configure in Apple Developer → Certificates, Identifiers & Profiles:

1. Register the explicit primary App ID `ch.zhstudio.rankwisp` with **Sign in with Apple**.
2. Register Services ID `ch.zhstudio.rankwisp.web`, enable Sign in with Apple, associate
   that primary App ID, and configure domain `rank.zhstudio.ch` with return URL
   `https://rank.zhstudio.ch/api/auth/apple/callback` (no wildcard).
3. Create a dedicated **Sign in with Apple** key for that primary App ID. Download the
   `.p8` once into protected storage; never commit it or place it in frontend variables.
4. Set Worker variables `APPLE_CLIENT_ID` (Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`,
   and `APPLE_REDIRECT_URI` (exact callback). Install secrets `APPLE_PRIVATE_KEY` (the
   PEM file contents) and `APPLE_TOKEN_ENCRYPTION_KEY` (base64 of 32 random bytes).
   Keep the latter stable: it encrypts existing revocable provider grants.
5. Apply migration `0003_apple_auth.sql` before deploying. It adds separate state/native
   handoff/grant tables and preserves all existing accounts and histories.
   Apply `0004_apple_account_linking.sql` as well: it adds explicit linked Apple
   identities, expiring encrypted link requests and per-session provider metadata.
6. Test real sign-in, cancellation, Hide My Email, logout, restart, native return and
   account-deletion revocation. Mock-provider tests do not substitute for this step.

Only the `email` scope is requested. The backend signs a five-minute ES256 client secret,
validates Apple's RS256 ID token, issuer, audience, freshness, nonce and verified email,
and binds the `form_post` callback to a one-use state and Secure/HttpOnly/SameSite=None
cookie. Only that exact callback accepts Apple's Origin; general CORS is not widened.
The normal application session remains Secure/HttpOnly/SameSite=Lax.

Apple subjects use a reserved `apple:` namespace in the legacy identity column. Accounts
are never automatically merged by email. When an Apple login matches an existing
Google email, the browser offers explicit linking: verify the original Google account
within ten minutes, then confirm the link with a same-origin POST and a separate
browser-bound one-use request. The pending Apple grant is encrypted and expires with
that request. D1 atomically inserts the identity/grant and consumes the request; the
existing account ID and workspace remain intact. Native completion still requires
the original device proof. A linked Apple login records Apple as the session provider.
Apple relay addresses are supported. Refresh grants are encrypted
with AES-GCM and bound to the user ID; account deletion first revokes the Apple grant.
The native flow uses the same device-bound PKCE/completion-code protections described
below, with `/api/auth/apple/...` routes. Apple does not receive a provider PKCE parameter.

References: [Apple web configuration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/),
[token validation](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens),
[token revocation](https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens).

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
3. Poll `POST /api/auth/google/native/exchange` with `{ticket,verifier}` for cancellation
   or pending status only. **Polling alone can never issue a session**, even after Google
   succeeds. This prevents an initiator from sharing a login link with another person
   and then polling to obtain that person's bearer token.
4. The callback page offers `Return to Rankwisp`, opening
   `rankwisp://auth/complete#ticket=...&code=...` on the browser's device. The random,
   one-use completion code is delivered only in this fragment; only its hash is stored.
   The native app accepts that exact route only for its own pending ticket.
5. Exchange `{ticket,verifier,completionCode}`. Both the originating app's PKCE verifier
   and the browser-local completion code are required. A wrong code or verifier does not
   consume the ticket. HTTP 200 returns `{token,account}` and consumes the handoff once.
6. Store the session token in the native OS secure store. macOS uses asynchronous Electron safeStorage operations, serialized writes and an atomic encrypted file. A pending OS prompt cannot write a session after logout. Cancellation/expiry terminates
   the handoff. Session/provider tokens are never placed in URLs; the custom-scheme
   fragment contains only the one-use completion secret, which is insufficient without
   the app-held verifier. Do not copy or share completion links.

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
PKCE, a complete signed mocked-provider callback and session, native shared-link phishing
resistance, replay/cancellation,
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
  `85f298b7-e54c-46d2-93f6-0f523989e9e8`.
- Preview: `https://rankwisp-api-preview.yannis-66678.workers.dev`, version
  `f07d969c-9ddc-44a7-8c4d-c79f7ee2f20b`.
- Actual HTTPS health/config returned 200 in both; production rejects hostile and branch
  origins with 403, preview accepts the exact project branch pattern, unauthenticated
  workspace returns 401. Google/AI/payment availability correctly remains false.
- A separate **real external Apple test** passed through local workerd, actual local D1
  and account/coordinator Durable Objects: public US Things 3 search, ID 904237743 lookup,
  project creation, durable refresh alarm, persisted positive rank and Apple HTTP/source
  provenance. This test injects only a synthetic local identity/session, not Apple replies;
  it creates no production bypass or account. It does not test Google live credentials.

Production uses the requested custom domain `rank.zhstudio.ch`. Configure Google consent
branding/domain verification for `zhstudio.ch`, and use the exact redirect
`https://rank.zhstudio.ch/api/auth/google/callback`. The Pages alias remains allowed for
API requests but OAuth start redirects to the canonical custom host before setting its
browser-binding cookie. Preview continues to use `development.rankwisp.pages.dev` with
separate credentials. Do not represent the shared `pages.dev` parent domain as owned.

### Canonical custom host

The production Worker was redeployed with `PUBLIC_ORIGIN=https://rank.zhstudio.ch`.
Both the custom origin and `https://rankwisp.pages.dev` are allowed API origins; the
OAuth browser flow canonicalizes to the custom host before state/cookie creation.
Actual `https://rank.zhstudio.ch/api/health` and `/de/` returned HTTP 200 after DNS/TLS
activation. Preview remains isolated at `development.rankwisp.pages.dev`.

## Luna keyword proposals

`POST /api/keyword-suggestions` is authenticated and requires an active writable
licence. It works before a project exists and for existing projects. Request:

```json
{"appleID":904237743,"country":"de","locale":"en","existingKeywords":["task list"]}
```

`appleID` is a positive safe integer; `country` must be a supported storefront;
`locale` is `en` or `de` for explanations. `existingKeywords` is optional (maximum
100 strings of 100 characters). Unknown request fields are rejected. Search keyword
language follows the storefront, independently of explanation language. Multilingual
storefront defaults are German for Switzerland and English for Canada/India; users
can edit proposals before saving.

Successful responses contain `mode:"ai"`, `suggestions:[{keyword,reason}]`, `model`,
`cached`, `generatedAt`, `reservedUSD`. There are at most ten ideas, with keywords
at most 60 and reasons at most 200 characters. NFKC/case/whitespace duplicates and
existing keywords are removed. Output is schema-validated and never includes
measured rank, volume or difficulty fields. Model instructions limit reasons to
app metadata and prohibit competitor brand stuffing and fabricated performance.
These remain unmeasured suggestions, not research measurements or guarantees.

The endpoint **never changes workspace, projects or keywords**. The frontend must
let users select/edit and explicitly confirm through the ordinary project/keyword
save endpoints. Only consent, AI accounting and tenant-specific cache are involved.
App metadata comes from the server's paced Apple lookup, never arbitrary client text.
Only bounded name/developer/category/description and existing terms go to OpenAI;
no account email, history or competitor objects are sent.

Feature-unavailability returns HTTP 200 with `mode:"unavailable"`, `suggestions:[]`
and a reason: `CONSENT_REQUIRED`, `AI_NOT_CONFIGURED`, `AI_BUDGET`, `AI_INPUT_LIMIT`,
`AI_UNAVAILABLE`, `AI_NO_SUGGESTIONS`, `APPLE_UNAVAILABLE`, `APPLE_APP_NOT_FOUND`.
Invalid input returns 400, missing session 401, expired licence 402 and rate limit
429. Consent is set explicitly through `PATCH /api/preferences {"aiConsent":true}`.
`/api/config.aiConfigured` reflects whether the server key exists, not a guarantee
of model access. Default model is `gpt-6-luna` via `OPENAI_MODEL`; set `OPENAI_API_KEY`
with Wrangler secrets separately in production and preview to activate it.

The same atomic account quota and global coordinator reservation as existing advice
apply, with a $0.02 default reservation and no automatic paid retry. Failed/uncertain
provider requests retain their reservation. Successful proposals cache for 24 hours
per account, model and bounded input. Cache hits require current consent/licence but
consume no further quota. Provider JSON follows the Responses API strict
[`text.format` JSON schema](https://developers.openai.com/api/docs/guides/structured-outputs).

Verification uses fixtures for OpenAI output: consent/key gates without network,
strict malformed-output rejection, language separation, deduplication, editable
proposal isolation, cache isolation, concurrent quota bounds, global Worker reservation,
and actual account-route validation run in Node and local workerd. No real OpenAI
credential is available: live Luna generation remains unverified and unavailable.

Suggestion requests have a 40-second overall deadline. Apple lookup waiting is capped
at 15 seconds; provider timeout is capped by the remaining deadline, with another
check after asynchronous global reservation. A timed-out queued Apple lookup may still
populate the shared public metadata cache, but cannot later trigger an OpenAI call.
A global reservation completed too late is conservatively retained without dispatch.

Keyword-proposal release verification (17 November 2026): 35 Node tests and 19
workerd tests passed, plus bundled startup smoke. Actual production and preview
Worker deployments succeeded with the versions recorded above. HTTPS health/config
returned 200, unauthenticated suggestion requests returned 401, and both environments
reported `aiConfigured:false`. These live checks do not claim successful authenticated
Luna generation; OpenAI and Google activation still require owner credentials.
