# Betrieb und Deployment

Stand: 17. November 2026. Private Quelle: `Yann1s2/Rankwisp`, Branch `main`.
Die Website ist öffentlich erreichbar, bleibt aber bis zur Produktfreigabe `noindex`.
Ein erreichbares Deployment bedeutet noch keine abgeschlossene Google-/Store-Freigabe.

## Tatsächlich eingerichtete Infrastruktur

| Umgebung | Website | API | Daten |
| --- | --- | --- | --- |
| Produktion | `https://rank.zhstudio.ch` | Pages-Service-Binding → `rankwisp-api` | D1 `rankwisp-identity`, eigene Account/Coordinator-DOs |
| Entwicklung | `https://development.rankwisp.pages.dev` nach Branch-Build | `rankwisp-api-preview` | D1 `rankwisp-identity-preview`, getrennte DOs |

Cloudflare Pages ist **nativ mit GitHub verbunden**, kein manuell hochgeladenes Ersatz-
Deployment. Build root `app`, Befehl `npm run build:pages`, Ausgabe `dist`.
`main` löst Produktion aus; andere Branches bekommen Vorschau-Deployments. Ein Push
auf `development` erzeugt die stabile Vorschauadresse. Preview-Daten und Sessions sind
von Produktion getrennt; nur der Preview-Worker akzeptiert die Projekt-Vorschauhosts.

Pages-Variablen: `NODE_VERSION=22.20.0`, `ELECTRON_SKIP_BINARY_DOWNLOAD=1`,
`SITE_URL` pro Umgebung. Keine Provider-Secrets in Pages oder `VITE_*`.
`app/wrangler.jsonc` enthält Service-Bindings; `app/worker/wrangler.jsonc` enthält
Worker-, D1-, DO- und Cron-Konfiguration. Die zwei D1-Datenbanken sind tatsächlich
angelegt und migriert. Keine R2-/KV-Ressourcen erforderlich.

`rank.zhstudio.ch` ist als Pages-Domain eingerichtet. Der Eintrag **CNAME `rank` →
`rankwisp.pages.dev`, Proxied, TTL Auto** wurde über das angemeldete Cloudflare-Dashboard
angelegt und bestätigt; HTTPS und API antworten erfolgreich. Die zuerst vorbereitete
ungenutzte Domain `rankwisp.zhstudio.ch` wurde vor Aktivierung wieder entfernt.
Bestehende Website-/Mail-Einträge wurden nicht verändert. Die pages.dev-Adresse bleibt
als Plattformadresse erreichbar; Google-Start leitet vor Cookieerzeugung auf die
kanonische Domain weiter.

## Backend veröffentlichen

```sh
cd app
npm ci
npm test
npm run test:worker
node worker/scripts/startup-smoke.mjs
npm run worker:check
npx wrangler d1 migrations apply rankwisp-identity --config worker/wrangler.jsonc --remote
npm run worker:deploy
# Getrennte Vorschau:
npx wrangler d1 migrations apply rankwisp-identity-preview --config worker/wrangler.jsonc --env preview --remote
npm run worker:preview
```

Migrationen vor Code mit neuen Spalten veröffentlichen. Vor destruktiven Migrationen
D1 exportieren und Wiederherstellungsplan testen; vorhandene Migrationen nie nachträglich
umschreiben. Die aktuelle Änderung enthält nur neue Ressourcen und additive Migrationen.

Frontend-Autodeployment ist aktiv. Der separate Workflow `deploy-workers.yml` ist
vollständig vorbereitet, aber absichtlich erst aktiv, wenn ein **dauerhafter, begrenzter
Cloudflare-CI-Token** installiert wurde. Die bestehende lokale Wrangler-OAuth-Sitzung
wird nicht als kurzlebiges GitHub-Secret kopiert. Einmalige Einrichtung in Repository
Settings → Secrets and variables → Actions:

- Secret `CLOUDFLARE_API_TOKEN`: Konto auf dieses Cloudflare-Konto begrenzen;
  Worker Scripts Edit, D1 Edit, Account Settings Read. Keine globale DNS-Berechtigung nötig.
- Variable `CLOUDFLARE_ACCOUNT_ID=afbaca3c7bb70def91d852aeb87ae6e0`.
- Danach `CLOUDFLARE_WORKER_DEPLOY_ENABLED=true` setzen und Preview-Workflow ausführen.

Anschliessend werden Backend-Änderungen auf `main`/`development` nach den Node-/workerd-
Tests automatisch in die jeweilige Umgebung veröffentlicht. GitHub-Qualitätsprüfungen
laufen bereits unabhängig davon auf Push/PR. Branchschutz kann nach dem ersten grünen
CI-Lauf mit dem Check `test` eingerichtet werden; kein ungeprüftes Erfinden von Checknamen.

## Fehlende Anbieter-Konfiguration

Google: genaue Console-Schritte und Redirect-URIs in [CLOUDFLARE-BACKEND.md](CLOUDFLARE-BACKEND.md).
`GOOGLE_CLIENT_ID` als Worker-Variable; `GOOGLE_CLIENT_SECRET` als Worker-Secret.
Produktion: `https://rank.zhstudio.ch/api/auth/google/callback`.
Vorschau: `https://development.rankwisp.pages.dev/api/auth/google/callback`, eigener Client.
Produktive Google-Konten erst nach Consent-/Domain-Konfiguration testen.

OpenAI: neuen `OPENAI_API_KEY` als Worker-Secret hinterlegen; gewünschtes Modell Luna
ist konfiguriert. Das offene bzw. früher offengelegte Secret wird nicht wiederverwendet.
Einwilligung, konservative Reservationsbudgets und Kontingente bleiben aktiv. Erst nach
realem Provider-Test als live kennzeichnen.

Stripe/StoreKit: Umgebungsvariablen und Secrets in Backend-Dokument und `.env.example`.
Apple-Roots werden auf Workers über `APPLE_ROOT_CERTS_BASE64` als JSON-Liste der
base64-kodierten DER-Zertifikate eingebracht, nicht als lokaler Verzeichnispfad.
`LEGAL_APPROVED=false` bleibt bis zu realen Betreiberangaben, geprüften Verträgen und
Händlerfreigabe gesetzt. Zahlungsprodukte wurden nicht erstellt/aktiviert.

## Smoke-Test nach jeder Veröffentlichung

- `/api/health`: 200, `runtime:cloudflare-workers`.
- `/api/config`: zutreffende Provider-Verfügbarkeit, keine Secrets.
- `/api/workspace` ohne Sitzung: 401; unerlaubter Origin: 403.
- Website EN/DE und `/app` laden, Console ohne unerwartete Fehler.
- Mit konfiguriertem Google-Client: Login, Abbruch, Logout, Seitenneuladen und native
  Rückleitung prüfen. Signed-Mock-Tests ersetzen diesen externen Schritt nicht.
- Echte Apple-Suche, Projekt, Messauftrag, gespeicherte Historie; keine erfundene Position.
- Vorschau-Origin nutzt ausschliesslich Vorschau-Daten.

## Daten und Wiederherstellung

Lokale Rankblick-/Node-Daten bleiben lokal. Nutzer exportieren und importieren selbst;
der Import zeigt Vorschau, prüft Revision und speichert alten Arbeitsbereich/Original.
Arbeitsbereiche liegen pro Konto in eigenen SQLite Durable Objects; Identitäten und
Session-Hashes liegen in D1. Benutzerexporte ergänzen Infrastruktur-Backups, ersetzen sie
nicht. D1 Time Travel und DO SQLite Point-in-time-Recovery müssen vor kommerziellem
Start in einem Wiederherstellungslauf verifiziert werden; eine vollständige Backup-
Wiederherstellung wurde in dieser Lieferung nicht behauptet.

Accountlöschung ist serverseitig tombstoned, invalidiert Sessions und entfernt den
Arbeitsbereich. Sie verlangt aktuelle Google-Authentifizierung und explizites DELETE.
Auth-Tokens werden nicht geloggt; Worker-Invocation-Logs sind deaktiviert, um OAuth-
Callback-Queryparameter nicht versehentlich in Zugriffslogs aufzunehmen.
