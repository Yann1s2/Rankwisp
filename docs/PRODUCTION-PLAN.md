# Production upgrade — 17 November 2026

## Baseline audit

React 19/Vite web UI shared by sandboxed Electron and Capacitor iOS. Local Express API,
node:sqlite accounts/workspaces, Apple public API, optional OpenAI/Stripe/StoreKit.
Initial source is a local Git repository with no remote. Existing installations and
personal Rankblick data remain out of scope for automatic changes.

Reported unavailable-server error: Auth sends POST `/api/auth/register`; startup also
calls `/api/config`, `/api/me`, `/api/workspace`. Native API fallback was 127.0.0.1:4318.
At audit no process listened there, so connection was refused before auth or routing.
The durable fix is an HTTPS deployment and release-time origin configuration, plus
bounded requests, actionable errors and retry. Restarting localhost alone is insufficient.

## Execution plan

1. Audit all code, dependencies, existing infrastructure and UI. Dedicated UI specialist,
   backend engineer and independent QA review assigned.
2. Preserve API/data contracts while moving persistent identity to D1, account state to
   separate SQLite Durable Objects, and global Apple/AI coordination to a dedicated DO.
   Use Workers alarms for durable refresh jobs. No unnecessary R2/KV services.
3. Add complete Google OIDC with PKCE/state/nonce/signature validation and native system-
   browser PKCE exchange. Preserve existing password accounts and import/export.
4. Redesign all screens around the five supplied colors. Compact adaptive app shell,
   meaningful content scroll regions and accessibility; later revised to a minimal abstract identity.
5. Configure GitHub source (public MIT after the user's explicit open-source request), Pages Git integration and preview builds; same-origin
   Pages API facade through Worker service binding, explicit environment isolation.
6. Test Node data logic, actual workerd bindings, cryptographic auth, all UI states,
   responsive dimensions, native packaging and live deployment connectivity.
7. Record actual deployment evidence, remaining external setup and reproducible commands.

## External facts discovered

GitHub API authenticates as Yann1s2 (account ID unchanged from previous username).
Cloudflare OAuth permits Pages/Workers/D1 deployments. DNS API rejects the existing
credential (403); the authorized CNAME rank.zhstudio.ch was subsequently created through
the logged-in dashboard and HTTPS verified. No Google OAuth credentials were
available in this project's configuration or current environment. No provider secret
is placed in frontend code or documentation.

## Release boundary

Public infrastructure deployment is authorized by the current master task. Real payment
activation and App Store submissions are separate actions. Missing Google credentials
must produce an explicit unavailable-provider state, never a simulated successful login.
