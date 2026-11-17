# Rankwisp — internationale Rankblick-Weiterentwicklung

Eine separate lokale Umsetzung mit neuer Arbeitsmarke, englischer/deutscher Website,
gemeinsamer App-Oberfläche, eigenem Server und nativen Desktop-/iOS-Paketen.
Die installierte Rankblick-App und ihre Produktivdaten wurden nicht verändert.

## Ansehen und starten

Auf diesem Mac `Start-preview.command` öffnen. Der Launcher startet den lokalen Server
und öffnet http://127.0.0.1:4318/de/. Node.js 22.20+ erforderlich. Alternativ im Ordner `app`:

```sh
npm ci
npm run build
npm run server
```

- Website: http://127.0.0.1:4318/de/
- App und echte Kontoerstellung: http://127.0.0.1:4318/app
- Klar gekennzeichnete Beispieldaten: http://127.0.0.1:4318/app?demo=1
- Die Demo wird niemals in ein echtes Konto übernommen. Neue Konten sind leer.
- Die Website bleibt `noindex`. Nichts wurde öffentlich veröffentlicht.

Die Desktoppakete sind Entwicklungsbuilds und erwarten derzeit den lokalen Server auf
Port 4318. Für eine Verteilung ausserhalb dieses Macs ist ein HTTPS-Backend und ein
Build mit dessen `VITE_API_ORIGIN` erforderlich. Kein Anbieter-Key befindet sich im Client.

## Was funktioniert

- Namens-/URL-/ID-Suche in 20 App-Store-Ländern über Apples echte Search/Lookup API;
  Original-Metadaten, Icons und App-Store-Links.
- Dreistufiges Onboarding, begründete Konkurrenzvorschläge mit korrigierbarer Auswahl,
  Keywords hinzufügen, gruppieren, archivieren und wiederherstellen.
- Messungen mit echter Ergebnisposition, Ergebnislisten, HTTP-Provenienz, Historie,
  fehlenden Treffern, Fehlern und Datenalter. Globale Apple-Drosselung, Caching,
  optionale tägliche Servermessungen und Wiederholungsabstand nach Fehlern.
- Monotone Diagrammkurven ohne Überschwinger, sichtbare Lücken, echte Messpunkt-Tooltips,
  Vergleichskurven und zugängliches Messprotokoll. Reduced Motion, Tastaturbedienung,
  mobile Navigation und Lade-/Leer-/Fehlerzustände.
- Rankblick-JSON-Import mit Vorschau, Versionsprüfung, Konfliktschutz und Sicherung von
  Originalupload sowie vorherigem Arbeitsbereich. Kein automatisches Lesen privater Daten.
- Authentifizierung, isolierte Kontodaten, Passwort-Hashes, HttpOnly-Websessions;
  native Sessions über macOS/Windows safeStorage bzw. iOS Keychain.
- Serverbasierte 24-Tage-Testphase und begrenzte Nutzungskontingente. iOS-Free-Trial-IAP
  und einmaliger StoreKit-Kauf vorbereitet, signierte Serverprüfung und Restore implementiert.
- Optionaler OpenAI-Proxy: bestätigtes `gpt-6-luna`, wählbares stärkeres Modell, Einwilligung,
  begrenzte Eingaben/Antworten, atomare Kostenreservierung, Caching und klare Offline-Hilfe.
- Einmaliger Stripe-Checkout, signierte/idempotente Zahlungswebhooks und Refund-/Dispute-
  Verarbeitung implementiert, ohne Händlerkonfiguration deaktiviert.
- 12 vorgerenderte EN/DE-Seiten inkl. Preis/Testphase, Support, FAQ und gekennzeichneten
  Rechtsentwürfen. SEO-Titel, Beschreibungen, Sitemap-/hreflang-Generator, Logo, App-Icon,
  Social-Asset; keine erfundenen Testimonials oder nicht verfügbaren Downloadbuttons.

App-Store-Connect-Berichte und die bisherige native Swift-Implementierung bleiben unter
`legacy` erhalten. Der neue universelle Client verbindet noch keine privaten Connect-
Schlüssel und portiert den Connect-Berichtdownload nicht auf Windows/iOS.

## Verzeichnis

| Pfad | Inhalt |
| --- | --- |
| `app/src` | Gemeinsame Website/App, Lokalisierung, Designsystem |
| `app/server` | API, SQLite, Apple, KI, Sitzungen, Trial/Lizenzen |
| `app/shared` | Datenvertrag, Migration, Datenqualität, Kurvensegmente |
| `app/desktop` | Electron-Sandbox und sichere Sitzungsspeicherung |
| `app/ios` | Echtes Xcode-/Capacitor-Projekt, StoreKit, Keychain, native Exportfreigabe |
| `app/tests` | Daten-/API-Tests und Browser-End-to-End-Tests |
| `legacy` | Separater Swift-Bestand, privater Seed entfernt |
| `releases` | Tatsächlich erzeugte Entwicklungsartefakte |
| `screenshots` | Aufgenommene lokale Vorschauen |
| `docs/QA.md` | Prüfstand und verbleibende Grenzen |
| `docs/PRICING-AND-LEGAL.md` | Preisempfehlung, Kostenmodell, Quellen und Launch-Gates |
| `docs/BRAND.md` | Namensrecherche und Gestaltungsgrundlagen |

## Entwicklungsbuilds

- `releases/Rankwisp-0.1.0-mac-arm64.zip`: macOS ARM64, lokal gestartet; nicht notarisiert.
- `releases/Rankwisp-0.1.0-win.zip`: Windows x64, gebaut; Windows-Laufzeitprüfung offen.
- `releases/Rankwisp-0.1.0-ios-simulator.zip`: Xcode-Simulator-App, kein Geräte-IPA.
- `releases/Rankwisp-0.1.0-source.zip`: bereinigter Quellstand einschliesslich Docs/Tests.

macOS-App nach dem Start des lokalen Servers öffnen. iOS-Projekt in Xcode über
`app/ios/App/App.xcodeproj` öffnen; zuerst im Ordner `app` `npm ci`, `npm run build`
und `npx cap sync ios` ausführen. Die ZIPs aktivieren keine realen Zahlungsprodukte.

## Sicherer Ersatz-Key

Der zuvor offengelegte Key wurde weder gesucht noch übernommen. Ersatzkey nur lokal
oder im Secret-Manager des späteren Servers hinterlegen, niemals im Chat:

```sh
cd app
cp .env.example .env
chmod 600 .env
```

`.env` in einem lokalen Editor öffnen und `OPENAI_API_KEY` dort setzen. Sie ist von Git,
Docker-Kontext und Quellcodearchiv ausgeschlossen. Server neu starten. Zunächst das
Provider-Projekt auf ein kleines Kostenlimit begrenzen. Keine `VITE_`-Variable für Secrets
verwenden: solche Variablen werden in Frontends eingebaut. KI bleibt ohne Key transparent
ausgeschaltet; die Kernfunktionen und regelbasierte Hilfe funktionieren weiter.

## Prüf- und Buildbefehle

```sh
cd app
npm test
npm run build
# Browser installieren oder PLAYWRIGHT_CHROMIUM_PATH auf ein vorhandenes Binary setzen:
npx playwright install chromium
npm run test:browser
npm run pack:mac
npm run pack:win
npx cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../../../work/ios-build CODE_SIGNING_ALLOWED=NO build
```

Swift-Bestand mit **synthetischer Testfixture**, leerem Produktionsseed:

```sh
swift test --package-path legacy --scratch-path ../../work/legacy-build
```

## Vor öffentlichem Start noch erforderlich

Rechtlicher Betreibername/Adresse und Vertragsfreigabe; Markenfreigabe/Domain;
HTTPS-Hosting und abgesicherte Backups; verifizierte E-Mail-/Wiederherstellungsprozesse;
Ersatz-Key und tatsächlicher KI-Projekttest; Händlerkonto/Produkte und echte Kauf-/Refund-
Tests; Apple-Free-Trial-Produkt; Signierung, Notarisierung und Store-Review; Windows-
Laufzeitprüfung sowie iOS-Geräte-/VoiceOver-Prüfung. Der aktuelle Preview-Server erlaubt
lokal offene Registrierung, Produktion erfordert HTTPS und einen starken Einladungscode.

Supportadresse ist bestätigt: **info@zhstudio.ch**. Weitere Betreiberangaben sind bewusst
nicht erfunden. Preisvorschlag: **CHF 49 einmalig**, keine automatische Zahlung nach 24 Tagen.
