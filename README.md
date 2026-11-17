# Rankwisp

App-Store-Recherche und Keyword-Verläufe für Web, macOS, Windows und iOS. Gemeinsame
React-Oberfläche mit eigenständiger Wisp-Marke, englischer/deutscher Website und
Cloudflare-Backend. Bestehende Rankblick-Installationen und persönliche Daten wurden
nicht verändert oder automatisch hochgeladen.

- Website/App: https://rank.zhstudio.ch · `/app?demo=1` zeigt ausdrücklich Beispieldaten.
- Privates Repository: https://github.com/Yann1s2/Rankwisp
- Support: **info@zhstudio.ch**
- Aktueller Prüfstand und verbleibende Freigaben: [QA](docs/QA.md).
- Betrieb und Deployment: [Operations](docs/OPERATIONS.md).
- Google-Einrichtung und Architektur: [Backend](docs/CLOUDFLARE-BACKEND.md).
- Gestaltung: [Designsystem](docs/DESIGN-SYSTEM.md).

## Funktionen

App-Suche in 20 Ländern über Apples echte Search/Lookup API, dreistufiges Onboarding,
begründete Konkurrenzvorschläge, Keyword-Gruppen/Archiv, dauerhafte Messaufträge,
Verläufe mit Lücken/Fehlern/Quellenbelegen, Vergleichskurven und zugängliches Messprotokoll.
Verlustfreier JSON-Import mit Vorschau, Konfliktschutz und Wiederherstellungskopien;
Export bleibt auch nach Testphasenende erreichbar. Arbeitsbereiche sind auf 16 MiB
kompaktes JSON begrenzt; Überschreitungen werden ohne Datenverlust abgewiesen.

Google OIDC mit PKCE, State, Nonce und signierten Tokenprüfungen ist implementiert.
Websessions sind HttpOnly; native Sessions liegen in Keychain bzw. OS-safeStorage.
**Echte Google-Anmeldungen benötigen noch die OAuth-Client-ID und das Client-Secret.**
Bis dahin nennt die Oberfläche die fehlende Verfügbarkeit ausdrücklich; eine Demo ist
kein echtes Konto. Der lokale Node-Server unterstützt weiterhin seine bisherigen
E-Mail-Konten; Produktionskonten nutzen Google. Datenmigration erfolgt bewusst per
Export/Import, nicht durch Übernahme unbestätigter E-Mail-Adressen.

Optionale KI mit Luna, Einwilligung und Kostenbudgets; Stripe-Einmalkauf und verifizierte
StoreKit-Integration sind vorbereitet. Ohne Anbieter-/Händlerkonfiguration sind diese
Dienste deaktiviert. 24 Tage Testphase, keine automatische Belastung. CHF 49 ist weiterhin
der Preisvorschlag; Betreiberangaben und Rechtsfreigabe sind offen. Website bleibt noindex.
Private App-Store-Connect-Berichte bleiben im erhaltenen Swift-Bestand `legacy` und sind
noch nicht in den gemeinsamen Client portiert.

## Architektur

| Pfad | Verantwortung |
| --- | --- |
| `app/src`, `app/public` | App, Website, Lokalisierung, Designsystem, Originalillustration/Icon |
| `app/worker` | Workers, D1-Identitäten, SQLite Durable Objects, Google OIDC, Alarme |
| `app/functions` | Same-origin Pages-API über Worker-Service-Binding |
| `app/server`, `app/shared` | Gemeinsame Fachlogik, lokale Express/SQLite-Alternative, Datenvertrag |
| `app/desktop` | Electron-Sandbox, CSP, sichere Sitzungsspeicherung |
| `app/ios` | Capacitor/Xcode, StoreKit, Keychain, Export, Haptik; iOS 15.4+ |
| `app/tests`, `app/worker/tests` | Node-, Browser- und echte workerd-Tests |
| `.github/workflows` | CI und vorbereiteter separater Worker-Deploy-Workflow |
| `releases`, `screenshots` | Lokal erzeugte Artefakte und visuelle Prüfbelege |

## Lokal entwickeln und prüfen

Node.js 22.20+ erforderlich. `Start-preview.command` startet weiterhin die lokale
Node-Alternative auf Port 4318. Für den produktionsnahen Workers-Pfad:

```sh
cd app
npm ci
npm test
npm run test:worker
node worker/scripts/startup-smoke.mjs
npm run build:pages
npx playwright install chromium
npm run test:browser
npm run worker:dev
```

Workers-Entwicklung benötigt die lokale D1-Migration; Details im Backend-Dokument.
Die Node-Alternative: `npm run build && npm run server`, App auf http://127.0.0.1:4318/app.
Nur synthetische Testdaten werden von automatisierten Tests erstellt.

## Native Builds

```sh
cd app
node scripts/assets.mjs --native
NATIVE_API_ORIGIN=https://rank.zhstudio.ch npm run build:native
npm run pack:mac
npm run pack:win
npm run ios:sync
```

Simulator bauen (lokale Ad-hoc-Signierung ist für Keychain erforderlich):

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../../../work/production/ios-build \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
```

Entwicklungsartefakte unter `releases`: `Rankwisp-0.2.0-mac-arm64.zip`,
`Rankwisp-0.2.0-win.zip`, `Rankwisp-0.2.0-ios-simulator.zip` und
`Rankwisp-0.2.0-source.zip`. Frühere 0.1.0-Archive sind als Bestand erhalten.

`build:native` verlangt eine explizite HTTPS-Adresse. Kein veröffentlichter Build fällt
stillschweigend auf localhost zurück. Native Artefakte sind Entwicklungsbuilds;
macOS-Signierung/Notarisierung, Windows-Laufzeitprüfung und echte iOS-Geräte-/Storetests
bleiben gesonderte Freigaben. Ein Simulator-Build ist kein App-Store-IPA.

## Secrets

Secrets nur im Cloudflare-Secret-Manager bzw. lokal in ignorierten `.dev.vars`/`.env`
hinterlegen. Niemals `VITE_` für Secrets verwenden. Ein zuvor offengelegter API-Key
wurde weder gesucht noch übernommen. Google, OpenAI und Händlercredentials werden
nicht im Chat oder Repository gespeichert. Genaue Variablen und verbleibende Schritte
stehen in den Betriebs- und Backend-Dokumenten.
