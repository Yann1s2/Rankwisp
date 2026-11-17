# Security

Please report suspected vulnerabilities privately to **info@zhstudio.ch** or use
GitHub's private vulnerability reporting when available. Include affected versions,
reproduction steps and impact, but never send production credentials or user exports.
Do not post sensitive findings in public issues. No response-time or bounty commitment
is implied.

## Public source, private credentials

The web app, native clients, backend, schemas, tests and deployment configuration are
open source. Domain names, callback URLs, service-binding names and resource identifiers
are configuration, not access credentials; access is enforced by authentication,
authorization and Cloudflare/GitHub permissions.

Never commit `.env`, `.dev.vars`, OAuth secrets, OpenAI keys, Cloudflare tokens,
payment secrets, signing certificates, real database exports or private user data.
Use Cloudflare secrets, GitHub Actions secrets and ignored local configuration instead.
A private repository is not a substitute for a secret manager. There is currently no
separate proprietary code repository: all application code is public.

## Development and contributions

Use synthetic accounts and data. Never run third-party PR code with production
credentials. Pull-request CI has read-only repository permissions and no deployment
secrets. Worker deployment is a separate gated workflow for trusted branches.
The `legacy` app can access local Rankblick data: use `RANKBLICK_DATA_DIR` for isolated
experiments and do not test against an installed user's workspace.

See [QA](docs/QA.md) for tested boundaries and outstanding provider/device validation.
