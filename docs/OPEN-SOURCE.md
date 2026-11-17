# Open-source boundary

The owner explicitly requested public source publication on 17 November 2026. Rankwisp
uses one public MIT repository: https://github.com/Yann1s2/Rankwisp. No separate private
code repository is needed for the current implementation.

## Included

Web and marketing UI, Electron and Capacitor clients, the preserved sanitized Swift
client, backend/auth logic, schemas, tests, build/deploy configuration, original branding,
license notices and operating documentation. The hosted product can still charge for
hosting/provider usage; the MIT-licensed source can be self-hosted and modified.

## Kept outside Git

OAuth/OpenAI/payment/Cloudflare credentials, signing private keys, real databases,
account/workspace exports, personal recordings and installed Rankblick data. Cloudflare
and GitHub secret stores hold deployment credentials when configured. Local files are
ignored. Resource IDs, service names and callback URLs are not authorization secrets.

## Publication review

- Gitleaks scanned all five pre-publication commits: no secret findings.
- Gitleaks scanned the current source tree: no secret findings.
- Independent manual review checked tracked files, legacy seed/history, configuration
  and 21 screenshots: no private account/customer datasets or credentials found.
- The legacy seed has been empty since the first commit; synthetic fixtures remain
  clearly labelled. Stale documentation claiming real seed observations was corrected.
- Runtime dependency notices and their verbatim license texts are preserved; original
  generated brand sources and prompts remain available.
- Pull-request quality checks have read-only permissions and no deployment secrets.
  Production deployment remains a separate trusted-branch workflow.

These are concrete checks of this release, not a guarantee that future contributions
cannot contain secrets. Follow SECURITY.md and review each new change before publishing.
