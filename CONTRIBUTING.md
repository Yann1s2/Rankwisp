# Contributing

Issues and pull requests are welcome. Describe the user-visible problem and include
reproduction steps, expected behavior and relevant test evidence. For vulnerabilities,
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

Use Node.js 22.20 or newer, then run from `app`:

```sh
npm ci
npm test
npm run test:worker
npm run build:pages
npx playwright install chromium
npm run test:browser
```

Use only synthetic data and local test bindings. Provider credentials are optional for
contributing; fixtures test their contracts and must never be presented as live results.
A local server is described in the README. To self-host, create your own Cloudflare
resources and Google OAuth client and replace deployment identifiers/origins following
[Operations](docs/OPERATIONS.md) and [Backend](docs/CLOUDFLARE-BACKEND.md).

Preserve measurement provenance, missing values, import compatibility and user history.
AI output must remain a reviewable suggestion, never fabricated search volume or rank.
Keep the minimal design, English/German copy and keyboard/reduced-motion support.
Do not include generated builds, credentials, database files or personal exports in PRs.

By submitting changes you agree that your contribution is provided under this project's
MIT license. Third-party material must retain its own attribution and license.
