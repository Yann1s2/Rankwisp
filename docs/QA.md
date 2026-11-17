# Qualitäts- und Releaseprüfung — 17. November 2026

Die App wurde implementiert und tatsächlich auf Cloudflare veröffentlicht. Echte Google-
Anmeldung, KI-Anbieter und Käufe sind mangels externer Credentials noch nicht freigegeben.
Dieser Bericht unterscheidet die laufende Infrastruktur von der kommerziellen Produktfreigabe.

## Automatisierte Prüfung

| Prüfung | Ergebnis / Aussage |
| --- | --- |
| Node-Fachlogik/API/native Sicherheit | **35/35 bestanden**; Import, Lizenz/Trial, Apple/AI, Zahlungen, Pfade/CSP/Handoff |
| Tatsächliche workerd-Umgebung | **19/19 bestanden**; D1/DO, signierter Mock-Google-Flow, Sitzungen, Tenant-Isolation, Alarme, Limits, Wiederherstellung |
| Gebündelter Worker-Kaltstart | **Bestanden**; startet den echten Build ausserhalb der Vitest-Transformation |
| Browser-End-to-End | **10/10 bestanden**; EN/DE, Konto/Import/Archiv/Export, Onboarding, Fehler, Tastatur, Layout, Accessibility |
| Native Client-Anmeldung mit Bridge-Fixture | **3/3 bestanden**; Geräte-Completioncode + PKCE vor Tokenaustausch, sichere Speicherung, Abbruch/Listener-Cleanup; Keychain-Retry, alte AbortSignal-Statics deaktiviert |
| Echte Apple-Netzwerkintegration in workerd | **Bestanden**; öffentliche Suche/Lookup, Projekt, Alarmmessung und persistierte echte Position/HTTP-Provenienz |
| Produktions-Webbuild | **Bestanden**, 12 statische EN/DE-Seiten plus gemeinsame App |
| Abhängigkeitsaudit | **0 bekannte Schwachstellen** nach Updates; Stand dieser Prüfung |

Apple-Netzwerktest nutzt eine synthetische Identität ausschliesslich in lokalem D1.
Google-Kryptotests nutzen signierte Mock-Provider-Tokens. Weder künstliche Produktions-
konten noch Auth-Bypass-Endpunkte wurden veröffentlicht. Die native Browser-Fixture
isoliert Rendererprotokoll/Speicherung; sie ersetzt weder echte Google-Zustimmung noch
native OS-Tests. Native CSP/Protokollfilter sind gesondert geprüft.

## Oberfläche und Verhalten

Dedizierter UI Design Specialist hat alle sechs App-Bereiche, Onboarding, Anmeldung,
Einstellungen und Website mehrfach visuell geprüft. Die anschliessende Minimalismus-
Revision entfernt Figuren und dekorative Sterne vollständig. Ein abstraktes Markenzeichen,
ein neues Icon und kompakte neutrale Hinweisbereiche ersetzen die verspielte Vorversion.
Das vollständige fünfteilige Farbsystem bleibt erhalten. Einstellungen sind in vier per
Tastatur bedienbare Tabs aufgeteilt. Diagrammtext passt sich kleinen Breiten an.

Automatisierte Matrix: **375×667, 390×844, 844×390, 768×1024, 1440×800**, jeweils
Overview, Keywords, Rank history, Competitors, Next moves und Settings. Alle **30
Kombinationen** ohne horizontalen/vertikalen Dokumentüberlauf; Wheel verschiebt das
Dokument nicht. Längere Listen bleiben in absichtlich vorgesehenen Inhaltsbereichen
scrollbar. Dialoge, Escape, Tabnavigation, Reduced Motion und mobile Navigation geprüft.

Axe WCAG A/AA/2.1-Prüfung von Website, Anmeldung und Übersicht: **keine schwerwiegenden
oder kritischen Verstösse**. Animationen sind während der Messung deaktiviert, damit
nicht ein kurzzeitig halbtransparenter Eintrittsframe als Textkontrast gewertet wird.
Das ist keine vollständige manuelle Screenreader-Zertifizierung.

Aktuelle Screenshots unter `screenshots/minimal-*.png`; `redesign-*` dokumentiert die
vorherige, inzwischen ersetzte Gestaltung. Native Keyboard-/Safe-Area-/Geräteprüfung
und weitere manuelle Assistive-Technology-Prüfungen bleiben zusätzlich erforderlich.

## Luna-Keyword-Vorschläge und offene Quellen

Die neue Vorschlagsfunktion ist im Onboarding und in der Keyword-Verwaltung eingebaut.
Sie verwendet öffentliche App-Metadaten, Store-Land und vorhandene Begriffe. Nutzer
können jede Idee bearbeiten und abwählen; „Use selected“ ergänzt nur den Entwurf.
Erst der separate Speicherschritt legt Keywords an. Manuelle Eingaben werden nicht
überschrieben. Ohne Provider-Konfiguration bleibt die manuelle Eingabe funktionsfähig.

Node-/workerd-Tests prüfen Einwilligung, Kontingente, globale Kostenreservation,
Mandantentrennung, Cache, unvollständige/ungültige Antworten, Unicode-Duplikate und
Trennzeichen, echte 100-Zeichen-Bestandskeywords sowie den 40-Sekunden-Zeitrahmen.
Die Route verändert niemals Arbeitsbereiche. Browserprüfungen belegen Bearbeitung,
Auswahl, Entwurferhalt, explizites Speichern, Fehler und Onboarding. Die Screenshots
`keyword-suggestions-*.png` nutzen ausdrücklich synthetische Provider-Fixtures;
sie belegen die Oberfläche, keinen echten Luna-Aufruf. Der API-Key fehlt weiterhin.

Vollständiger Quellcode wird mit ausdrücklicher Autorisierung unter MIT veröffentlicht.
[OPEN-SOURCE.md](OPEN-SOURCE.md) dokumentiert Secret-Scan, manuelle Datenprüfung und
Lizenzhinweise. GitHub-Verweise sind in Website-Navigation, Footer und Kontoeinstellungen
integriert; native Links öffnen nur das freigegebene Repository im Systembrowser.

## Tatsächlich behobene Fehler

- Ursprüngliche Servermeldung: Native Builds zeigten auf `127.0.0.1:4318`, ohne dort
  laufenden Server. Jetzt explizite HTTPS-Buildadresse, kein stiller Release-Localhost-
  Fallback, begrenzte Requests und aussagekräftige Wiederholungs-/Konfigurationszustände.
- Cloudflare-Deployment scheiterte zuerst an globaler Zufallserzeugung in Apples SDK.
  SDK wird jetzt innerhalb der Anfrage geladen; echter Worker-Kaltstart und Remote-
  Deploy belegen den Fix.
- Mindest-iOS jetzt 15.4; API benötigt weder `AbortSignal.timeout` noch `AbortSignal.any`.
- Native Google-Links allein genügen nicht für Sitzungsübernahme: zusätzlicher Einmal-
  Completioncode kommt ausschliesslich über die lokale App-Rückleitung. Fremde Tickets,
  manipulierte URLs und Wiederholungen werden abgewiesen.
- Große Unicode-Arbeitsbereiche/Recovery werden chunkweise gespeichert; über 16 MiB
  erfolgt atomare Ablehnung, kein Abschneiden. Originalimport und vorheriger Stand bleiben
  erhalten. Import/Messauftrag-Konflikte schreiben nicht in veränderte Keywords.
- Preview-CORS, interne Messratenlimits, Metadatenrefresh und verspätete Zahlungsereignisse
  bei Refund/Dispute korrigiert. StoreKit-Transaktionen werden erst nach Serverannahme beendet.
- Landschaftsüberlauf, kleine Diagrammbeschriftungen und zu schwache Marketingkontraste
  wurden durch echte Browserprüfungen gefunden und korrigiert.

## Native Laufzeit

Electron-Sicherheits-/Bridge-Test im echten Prozess bestanden: keine Node-API im Renderer,
strikte CSP, sicherer Sessionstore, exakte OAuth-/Callback-URLs, nur lokal gestartetes
Ticket, einmalige Zustellung, Abmeldung des Listeners. Browseröffnung im Handoff-Test
wurde ersetzt; es wurde kein echter Google-Login behauptet.

Finale macOS-App **0.2.0** als tatsächlich gepackte `.app` gestartet: echte HTTPS-
Konfiguration von `rank.zhstudio.ch`, korrekter Google-Verfügbarkeitszustand, Demo,
kein Node-Zugriff im Renderer, keine Laufzeitfehler und kein Dokumentüberlauf. Separates
Testprofil; persönliche App-Daten unberührt. Windows-ZIP gebaut, Name/Icon/Ressourcen
aktualisiert; Windows-Laufzeittest weiterhin offen.

Finaler iOS-Simulatorbuild **0.2.0 (2), iOS 15.4+** ad hoc signiert, installiert und
visuell geprüft. Neue Loginoberfläche und Safe Areas korrekt; Live-Config wird geladen,
kein Server-/Keychainfehler. Ein zunächst unsignierter Build lieferte Keychainfehler
−34018; SDK-spezifische Simulator-Entitlements und Ad-hoc-Signing beheben ihn.
Leerer Keychain liefert danach erwartungsgemäss −25300. URL-Scheme-Dispatch geprüft;
unaufgeforderter Callback gewährt keine Sitzung. Screenshot `native-ios-login.png`.
Die Simulator-Steuerung war im CUA-Werkzeug nicht verfügbar; echte native Touch-,
Demo- und Keyboard-Flows wurden deshalb nicht als geprüft ausgegeben. Physische Geräte,
VoiceOver, Geräte-Signierung, macOS-Notarisierung und Store-Review bleiben offen.

## Infrastruktur und offene Freigaben

GitHub ist mit Cloudflare Pages nativ verbunden. Produktion und Vorschau haben eigene
Workers/D1/DOs. Live health/config antworten 200, unauthentifizierte Arbeitsbereiche 401,
fremde Origins 403. `rank.zhstudio.ch` wurde als Pages-Domain mit CNAME konfiguriert.
GitHub-Actions-Qualitätsprüfungen und native GitHub-Push-Deployments für `main` und
`development` wurden erfolgreich durchlaufen. Live App-Routing, Google-Fehler-Rückleitung,
Support-E-Mail, Canonical/hreflang und noindex auf beiden Umgebungen bestätigt.
Cloudflare-HTML-Transformationen störten zunächst CSP/Hydration; `no-transform` behebt
die beobachteten Fehler. `/app/` hat einen eigenen statischen SPA-Einstiegspunkt.

Offen vor kommerziellem Betrieb:

1. Google OAuth Client-ID/Secret, Consent-Konfiguration und echter Web-/Native-Anmeldetest.
2. Optionaler neuer OpenAI-Key und realer Modelltest; Luna ist konfiguriert, nicht als
   tatsächlich live verwendeter Provider ausgegeben.
3. Betreibername/Geschäftsadresse, rechtliche Freigabe, Markenfreigabe und Händlerprodukte.
   Supportadresse `info@zhstudio.ch` ist bestätigt.
4. Echte Stripe-Testkonto- und StoreKit-Sandbox-/OCSP-Tests, dann erst Zahlungsaktivierung.
5. Signierte/notarisierte Distributionspakete, Windows-Laufzeit, echtes iOS-Gerät/VoiceOver.
6. Dauerhafter begrenzter Cloudflare-CI-Token für den separaten Worker-Autodeploy-Workflow;
   Frontend-Autodeployment ist bereits aktiv.
7. Betriebswiederherstellung aus Cloudflare-Backups praktisch durchführen; lokale
   Import-/Recovery-Tests sind kein vollständiger Infrastruktur-Disaster-Recovery-Test.

Der private App-Store-Connect-Berichtdownload bleibt im erhaltenen Swift-Bestand;
er wurde nicht als universelle Windows-/iOS-Funktion ausgegeben. Historische Belege
in `IMPLEMENTATION.md` beziehen sich auf die Vorversion; dieser Prüfstand hat Vorrang.
