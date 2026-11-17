# Get started with Rankwisp

[English README](../README.md) · [Deutsch](../README.de.md)

## Choose your starting point

| Goal | Start here |
| --- | --- |
| Explore the interface | [Open the browser demo](https://rank.zhstudio.ch/app/?demo=1). It uses fictional data and needs no account. |
| Research an app using real Apple responses | Run the local Node app below. No Apple API key is required. |
| Try a native client | [Download a preview](https://github.com/Yann1s2/Rankwisp/releases/tag/v0.2.0-preview.1). Hosted login is not configured yet; the demo is available. |
| Host your own multi-user service | Create your own Cloudflare resources and Google OAuth client using [Operations](OPERATIONS.md) and [Backend](CLOUDFLARE-BACKEND.md). |

## Run the local app

Install Node.js **22.20 or newer**, npm and Git. Check `node --version` before starting.

```sh
git clone https://github.com/Yann1s2/Rankwisp.git
cd Rankwisp/app
npm ci
npm run build
npm run server
```

Open **http://127.0.0.1:4318/app/**. The server binds to loopback by default.

1. Choose **Continue with email** → **New here? Start your free trial**.
2. Enter an email and a password of at least 12 characters. This creates a **local account**; it does not send a verification email or create a hosted Google account.
3. Find your app by name, numeric Apple ID or App Store URL. Choose the storefront you want to inspect.
4. Select competitors if useful, then enter your first keywords. Suggestions can be skipped.
5. Create the workspace and press **Refresh**. The first successful request creates the first observation.
6. Use **Export** to keep a portable JSON copy of your work.

The default application usage limits, including the 24-day trial, are still enforced in this source version. MIT permits modifying the source; it does not supply hosted service access or provider credits. No payment is required or automatically collected by this local setup.

Data is stored in `app/.data/rankwisp.sqlite`, outside Git. Export before moving or deleting it. An installed Rankblick workspace is never imported automatically. Use a separate `DB_PATH` for tests or experiments.

For a live-editing frontend, keep the Node server running and use a second terminal in `app`:

```sh
npm run dev
```

Use the URL Vite prints. The production-style single-server setup above is enough to start.

## Optional providers

The basic Apple research flow does not require an OpenAI key, Google OAuth credentials or a merchant account.

| Capability | Configuration |
| --- | --- |
| Luna suggestions | `OPENAI_API_KEY`, optional `OPENAI_MODEL`; explicit account consent and usage budgets still apply |
| Google sign-in on Workers | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, exact callback URL and your own Google consent configuration |
| Payments | Separate Stripe/Apple merchant setup plus legal approval; disabled by default |

For the local server, copy `app/.env.example` to `app/.env` and change only values you understand. `npm run server` loads this ignored file. For Cloudflare, use Worker secrets. **Never put credentials in `VITE_*`, Git, issues or screenshots.**

The `gpt-6-luna` default is configurable. A real provider/model availability test is still outstanding; fixtures establish the API contract, not provider access. A failed or unavailable AI request must never prevent manual keyword entry.

## Preview downloads

Every native archive is a **development preview**, not a signed public-store release.

- **macOS:** Apple Silicon only. Unzip the archive to inspect the app. It is not Developer-ID signed or notarized, so macOS may block it. The browser demo and local source build remain alternatives; do not disable system protections globally.
- **Windows:** x64 portable ZIP. Not signed and not yet runtime-tested on Windows. No automatic installer or updater is included.
- **iOS:** Xcode Simulator app, not an IPA for a physical iPhone and not a TestFlight release. The built artifact was visually verified on iOS 18.6.

The native packages point to `https://rank.zhstudio.ch`; hosted Google sign-in remains unconfigured. They are useful for exploring the native demo. To use your own backend, build from source with its HTTPS origin.

Compare downloaded ZIP files against `SHA256SUMS-0.2.0.txt` on the release page:

```sh
# macOS
shasum -a 256 Rankwisp-0.2.0-mac-arm64.zip
# Linux
sha256sum Rankwisp-0.2.0-win.zip
```

```powershell
# Windows PowerShell
Get-FileHash .\Rankwisp-0.2.0-win.zip -Algorithm SHA256
```

A matching checksum verifies the download against the published artifact; it is not a code-signing certificate or a security audit.

## Native builds

From `app`, after `npm ci`, point the build at **your own deployed HTTPS backend**:

```sh
node scripts/assets.mjs --native
NATIVE_API_ORIGIN=https://your-backend.example npm run build:native
npm run pack:mac
npm run pack:win
npm run ios:sync
```

`pack:mac` is configured for Apple Silicon. Packaging is platform/toolchain dependent. To build the iOS Simulator app on a Mac with Xcode:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../../rankwisp-ios-build \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
```

Ad-hoc simulator signing is required for the Keychain bridge. Physical-device distribution needs your own Apple signing setup. Local output can be placed outside the repository; do not commit generated builds.

After packaging, `npm run build` restores a normal web build for local development. A native build intentionally points at its configured remote API.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Node cannot load `node:sqlite` | Use Node 22.20+ and rerun `npm ci`. |
| Port 4318 is already in use | Stop the previous development server, or set matching `PORT` and `PUBLIC_ORIGIN` values in `.env`. |
| “Server unavailable” in a local preview | Keep `npm run server` running. Confirm `http://127.0.0.1:4318/api/health` responds. Run `npm run build` if the last build was native. |
| Google is unavailable | This is expected without OAuth credentials. Use local email auth or the public demo. |
| AI is unavailable | Check the server-side key/model, consent and allowance. Manual keywords remain available. |
| Apple requests are slow or limited | Requests are paced. Do not retry repeatedly; wait and inspect the observation error. |
| A position differs from your iPhone | The app records public Search API order, not the iPhone search interface. |
| An imported file is rejected | Keep the original. Check the error and size limit; do not truncate history to force an import. |

For reproducible bugs, use the [bug report form](https://github.com/Yann1s2/Rankwisp/issues/new?template=bug_report.yml). Include platform, version and steps, but no credentials or private exports. Security findings belong in [private reporting](../SECURITY.md).
