> Historischer Implementierungsstand der lokalen Vorversion. Aktuelle Architektur und Betrieb: [Cloudflare Backend](CLOUDFLARE-BACKEND.md), [Operations](OPERATIONS.md), [QA](QA.md).

# Rankwisp — implementation ledger

Date: 2026-11-17. Separate source copy; production Rankblick untouched.

## Architecture

React/Vite shared interface, Electron sandboxed desktop packages for macOS/Windows,
Capacitor native Xcode iOS project. Express + SQLite single-authority backend for sessions,
immutable trial dates, tenant-separated workspaces, Apple request pacing, AI budgets and
payment verification. Native packages do not embed provider keys or an authoritative
license database. Production native clients require an HTTPS backend.

The existing macOS Swift implementation remains under legacy, including its App Store
Connect report browser/downloader. Private bundled seed replaced with an empty workspace.
No personal database, Connect key or report was copied. New universal client imports
Rankblick schema 1 losslessly after preview and explicit selection; the original file
is never modified. Imported source retained per account for recovery.

## Milestones and acceptance

1. Audit and isolation: read models/repository/API clients; run original offline tests.
2. Brand and UI: Rankwisp provisional wordmark/icon; EN/DE website and app; keyboard,
   responsive layout, reduced motion; find/select app, edit competitor hypotheses.
3. Data: actual Apple search/lookup; rank snapshots, archive, error preservation, history
   gaps, monotone curves; import/export without fake observations.
4. AI: Luna default, optional stronger decision model, source-bound summaries,
   explicit transmission consent, budgets/cache/rate limits; transparent fallback.
5. Commerce: authoritative 24-day trial; one-time checkout and signed webhook;
   StoreKit integration/server verification; restore via account; read/export retained.
6. Release: local website preview and packaged desktop/iOS builds; real QA evidence;
   operator details, legal review, payment IDs, signing and hosting remain launch gates.

## Scope boundaries

App Store Connect credentials and analytics reports stay in the legacy app. New UI
must not call public App Store ratings “App Store Connect analytics”. No provider
credentials or personal exports are accessed automatically. The new server is not
published and paid service is not activated by this implementation.

## Pending real information

Support: info@zhstudio.ch (confirmed). Legal operator name/address, jurisdiction/tax
status, payment merchant, data hosting region, processor agreements, refund policy,
final brand clearance and domain remain required. No invented legal identity.

## Delivered state

Milestones 1–4 implemented locally and tested with the limits in QA.md. Commerce
code and native bridges are implemented; merchant/provider configuration and real
purchase validation remain outstanding. Desktop packages and a compiled iOS simulator
app are supplied. Nothing has been published, submitted to a store, or charged.
