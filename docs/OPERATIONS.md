# Betrieb und Sicherheitsgrenzen

## Lokale Isolation

Produktivdaten von Rankblick wurden nicht gelesen oder verändert. Die Arbeitskopie
enthält keine `.p8`, `.pem`, Anbieter-Secrets oder private Startmessungen. Das alte
`Resources/seed.json` wurde durch einen leeren, pausierten Arbeitsbereich ersetzt.
Swift-Tests verwenden eine explizit synthetische Fixture. Historische Funktionstests
laufen damit unabhängig von persönlichen Daten.

## Server

Node 22.20+, ein aktiver Serverprozess pro SQLite-Datenbank. `DB_PATH` liegt auf einem
persistenten, nur für den Dienst lesbaren Volume. Datenbankverzeichnis 0700, Datei 0600.
WAL und Transaktionen sichern Kontingente, Importe und Zahlungen. Für Replikation/mehrere
Regionen ist eine zentrale Queue/DB nötig; nicht mehrere unabhängige SQLite-Dateien starten.

Produktion erfordert `NODE_ENV=production`, HTTPS `PUBLIC_ORIGIN`, mindestens 24 Zeichen
`INVITE_CODE`, explizite `ALLOWED_ORIGINS`, TLS-Reverseproxy und persistente Backups.
Der Container ist vorbereitet, aber nicht auf einem Host gebaut oder ausgerollt.
API-Logs enthalten keine Requests, Tokens, Providerantworten oder Passwörter. IP-Adressen
werden für Missbrauchslimits nur als Hash gespeichert und nach spätestens dem täglichen
Cleanup verworfen; keine Behauptung vollständiger Anonymität. Proxy-Header werden nicht
blind vertraut. Bei Reverseproxy muss die Rate-Limit-IP-Strategie gezielt konfiguriert werden.

Kein offenes öffentliches Account-Signup in Produktion: Einladungen begrenzen Missbrauch.
E-Mail-Verifikation und sichere selbstständige Recovery müssen vor offenem Signup ergänzt
werden. Support darf Kontozugriff nicht allein auf Grundlage einer E-Mail-Behauptung erteilen.

## Geheimnisse und Sessions

Providerkeys ausschliesslich Server-Umgebung/Secret-Manager. Native Clients enthalten nur
die API-URL. Browser: HttpOnly, SameSite=Strict, in Produktion Secure. Native Clients:
zufälliger Session-Token in OS-verschlüsseltem Speicher (safeStorage/Keychain), nie
localStorage. Server speichert Token-Hashes und prüft Ablauf nach sieben Tagen.
Electron: Sandbox, Context Isolation, kein Node im Renderer, Berechtigungen abgelehnt,
IPC auf eigenen Ursprung begrenzt, externe Navigation auf Apple/Checkout/Support beschränkt.

## Wiederherstellung

JSON-Import prüft Schema/IDs und zeigt Mengen vor dem Commit. Compare-and-swap gegen
Workspace-Revision verhindert veraltetes Überschreiben. Originalupload und vorheriger
Workspace bleiben in der Importtabelle exportierbar. Automatik wird beim Import pausiert.
Externes Rankblick-Original bleibt unangetastet. Zur Rückkehr vorherigen Workspace aus
Sicherung exportieren und erneut über die Vorschau importieren. Unbekannte Dateiversionen
werden abgelehnt. Die Universal-App erhält unbekannte zusätzliche JSON-Felder.

Für echte Server-Backups SQLite Online Backup API oder `VACUUM INTO` verwenden, nicht
nur die Hauptdatei während eines WAL-Schreibvorgangs kopieren. Wiederherstellung in einer
separaten Instanz testen. Backup-Aufbewahrung/-Verschlüsselung und Zahlungspflichten vor
Launch definieren; Kontolöschung im Preview löscht DB-Datensätze inklusive Importkopien.

## Telemetrie

Website ohne Telemetrie. Produkt zählt nur nach freiwilligem Opt-in aggregierte Events
(onboarding_complete, refresh_complete, export). Keine Projekt-/Keywordnamen oder IDs in
diesen Zählern. Tabelle trennt `surface=app`/`website`; 30 Tage Aufbewahrung. Messwerte
für App-Store-Analyse sind getrennte fachliche Daten und keine Nutzertracking-Kennzahlen.
Die Telemetrie ist kein externes Marketingdashboard; Auswertung lokal über aggregierte
DB-Abfragen. Vor öffentlichem Betrieb Retention, Einwilligung und Datenschutzhinweise
mit den tatsächlich eingesetzten Diensten abstimmen.

## Release

`SITE_URL` erst mit echter autorisierter HTTPS-Domain setzen, dann bauen: Canonical,
hreflang und Sitemap werden generiert. `noindex`/robots bleiben absichtlich bestehen;
Entfernung ist ein separater überprüfter Launch-Schritt. Native Builds benötigen
`VITE_API_ORIGIN=https://<echter-server>` und exakt passenden erlaubten Ursprung.
Keine Secrets mit `VITE_` prefix. Apple Root-Zertifikate aus offizieller PKI beziehen,
Bundle/App/Product IDs und Sandbox/Production konsistent halten. Keine Store-Passwörter
oder Signierungsidentitäten automatisch übernehmen.

Windows-Paket ist portabel und ohne Signatur/EXE-Resource-Editing gebaut; tatsächlicher
Windows-Test und Code Signing fehlen. macOS derzeit ARM64, kein Universal-/Intel-Build,
keine Developer-ID/Notarisierung. iOS-Artefakt ist für den Simulator, kein installierbares
Geräte-IPA. Live-Kaufprüfungen und Push-/E-Mail-Berichte sind nicht erfolgt; es werden
keine Nachrichten automatisch versendet.
