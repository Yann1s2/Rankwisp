# Qualitäts- und Releaseprüfung — 17. November 2026

Die App wurde implementiert und tatsächlich auf Cloudflare veröffentlicht. Echte Google-
Anmeldung, KI-Anbieter und Käufe sind mangels externer Credentials noch nicht freigegeben.
Dieser Bericht unterscheidet die laufende Infrastruktur von der kommerziellen Produktfreigabe.

## Automatisierte Prüfung

| Prüfung | Ergebnis / Aussage |
| --- | --- |
| Node-Fachlogik/API/native Sicherheit | **28/28 bestanden**; Import, Lizenz/Trial, Apple/AI, Zahlungen, Pfade/CSP/Handoff |
| Tatsächliche workerd-Umgebung | **17/17 bestanden**; D1/DO, signierter Mock-Google-Flow, Sitzungen, Tenant-Isolation, Alarme, Limits, Wiederherstellung |
| Gebündelter Worker-Kaltstart | **Bestanden**; startet den echten Build ausserhalb der Vitest-Transformation |
| Browser-End-to-End | **7/7 bestanden**; EN/DE, Konto/Import/Archiv/Export, Onboarding, Fehler, Tastatur, Layout, Accessibility |
| Native Client-Anmeldung mit Bridge-Fixture | **2/2 bestanden**; Geräte-Completioncode + PKCE vor Tokenaustausch, sichere Speicherung, Abbruch/Listener-Cleanup; alte AbortSignal-Statics deaktiviert |
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
Einstellungen und Website mehrfach visuell geprüft. Originalillustration Wisp und Icon
verwenden das vollständige fünfteilige Farbsystem. Einstellungen sind in vier per
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

Screenshots unter `screenshots/redesign-*.png`. Native Keyboard-/Safe-Area-/Geräteprüfung
und weitere manuelle Assistive-Technology-Prüfungen bleiben zusätzlich erforderlich.

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

Xcode-Simulatorbuild mit iOS-15.4-Minimum, SceneDelegate, Keychain, StoreKit und URL-
Rückleitung erfolgreich. Finaler synchronisierter UI-Lauf und Paketprüfungen werden im
Abschlussbericht ergänzt. Windows-Artefakt wird auf macOS gebaut; ein Windows-Laufzeittest
ist damit nicht belegt. Geräte-Signierung, Notarisierung und Store-Review sind nicht erfolgt.

## Infrastruktur und offene Freigaben

GitHub ist mit Cloudflare Pages nativ verbunden. Produktion und Vorschau haben eigene
Workers/D1/DOs. Live health/config antworten 200, unauthentifizierte Arbeitsbereiche 401,
fremde Origins 403. `rank.zhstudio.ch` wurde als Pages-Domain mit CNAME konfiguriert.
GitHub-Actions- und Branch-Deploy-Ergebnisse werden nach dem letzten Push final geprüft.

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
