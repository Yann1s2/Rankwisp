# Third-party notices

The MIT license in this repository covers original Rankwisp code, documentation and
included original brand assets. It does not relicense third-party dependencies, service
content, trademarks or app artwork returned by Apple. Generated brand asset provenance
and prompts are documented in [docs/brand/ASSETS.md](docs/brand/ASSETS.md).

Runtime dependencies retain their upstream licenses:

| Dependency | License |
| --- | --- |
| @apple/app-store-server-library | MIT |
| @capacitor/core, @capacitor/ios | MIT |
| d3-shape | ISC |
| express | MIT |
| jose | MIT |
| lucide-react | ISC |
| react, react-dom | MIT |
| stripe | MIT |
| zod | MIT |

Verbatim upstream texts are included in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt),
regenerated with `cd app && npm run licenses`. They are also bundled in web/iOS builds
under `/licenses/` and in desktop resources under `licenses/`.

Exact resolved versions and transitive dependency license identifiers are recorded in
`app/package-lock.json`. Installed packages contain their own license texts. Build and
test tooling, including Electron, Vite, Playwright, Wrangler and their dependencies,
retains its respective upstream licenses. Keep the license/notice files bundled by
Electron and electron-builder when redistributing desktop artifacts.

The hosted service, Google, Apple, OpenAI, Cloudflare and payment providers have separate
service terms. Source availability grants no access to the hosted service's accounts,
credentials or infrastructure and does not imply endorsement by those providers.
