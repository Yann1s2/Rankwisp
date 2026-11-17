# Prüfbericht — 17. November 2026

Geprüft wurde die separate Entwicklungsfassung Rankwisp 0.1.0. Keine Produktion,
keine echten Zahlungen und keine privaten Rankblick-Daten wurden für die Tests verwendet.

## Automatisiert

| Bereich | Ergebnis | Aussage |
| --- | --- | --- |
| Neue Daten-/Servertests | 23 bestanden | Import, Nullwerte, Fehler, Kontentrennung, Session/CSRF, Trial, Export, Budgets, Zahlungszustand |
| Browser-End-to-End | 4 bestanden | EN/DE, responsive Navigation, Demo/Keyboard/Reduced Motion, Registrierung, Import, Archive, Export, KI-Fallback, Logout, Onboarding |
| Swift-Bestand | 31 bestanden | Bisherige Core-Funktionen mit explizit synthetischer Fixture |
| Frontend-Build | bestanden | 12 vorgerenderte Seiten, ca. 137 KB JavaScript gzip |
| Produktionsabhängigkeiten | 0 bekannte npm-audit-Funde beim Prüfzeitpunkt | Keine Aussage über Fehlerfreiheit oder künftige Sicherheitsmeldungen |

Browser-Onboarding verwendet kontrollierte Apple-Fixtures für reproduzierbare UI-Zustände.
Ein separater echter Netzwerktest prüfte den vollständigen Serverweg am 17.11.2026,
00:15:43 UTC: Registrierung in isolierter QA-Datenbank → Apple-Suche → Lookup →
Projektanlage → Keywordmessung → gespeicherter Workspace. US-Suche `Things 3`,
Apple-ID 904237743, 161 Ergebnisse, beobachtete Position 1, eine erfolgreiche Messung,
keine Messfehler; Quelle `apple-search-v1` und HTTP-Datum gespeichert. Das ist eine
punktuelle Beobachtung dieser API, kein garantierter Rang auf jedem Gerät.
Der erste Netzwerkversuch schlug vor der Messung fehl; der erneute eigenständige
Test war erfolgreich. Fehler werden nicht in erfundene Messpunkte umgewandelt.

## Native Plattformen

- **macOS ARM64:** finales Electron-Paket gestartet. Login und Beispiel-Dashboard sichtbar;
  native Bridge geladen, `window.require` nicht verfügbar. Verschlüsselten Session-Speicher
  mit einem kurzlebigen synthetischen Token geschrieben, gelesen und wieder gelöscht.
- **Windows x64:** portables ZIP erfolgreich erstellt. Auf Windows nicht ausgeführt;
  kein Code Signing, keine angepasste EXE-Ressource. Kein behaupteter Windows-Laufzeittest.
- **iOS:** Xcode-Simulatorbuild erfolgreich. Der erste Start zeigte einen echten
  UIScene-Lebenszyklusfehler; SceneDelegate und Manifest wurden korrigiert und erneut
  erfolgreich gebaut und auf dem eigens angelegten iOS-27-Simulator installiert.
  Der korrigierte App-Prozess wurde gestartet; ein erneuter gleicher Crash wurde nicht
  beobachtet. Die Simulator-Aufnahme zeigte dennoch den Startbildschirm, und weitere
  Launch-/Screenshot-Aufrufe blieben verzögert. **Eine funktionierende sichtbare iOS-
  App-Sitzung ist nicht bestätigt.** Diese Laufzeitprüfung bleibt vor Geräteverteilung offen.

Die Scene-Migration folgt [Apples technischer Anleitung](https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle).
Native Pakete erwarten den lokalen Server; Geräte-/Releasebuilds benötigen einen
konfigurierten HTTPS-Endpunkt. Der Simulatorbuild ist kein Geräte-IPA.

## Visuelle Kontrolle

Desktop-Dashboard, Website auf 390 px und macOS-Login aufgenommen. Kein horizontaler
Overflow im mobilen Browser-Test. Diagramme beruhen auf echten Punkten; die ausdrücklich
markierte Demo verwendet ausschliesslich erfundene Beispieldaten. Diagrammlücken,
Tastaturfokus und reduzierte Bewegung sind in Oberfläche/Tests berücksichtigt.
Eine umfassende VoiceOver-/Screenreader- oder WCAG-Zertifizierung ist nicht erfolgt.

## Externe Dienste und verbleibende Grenzen

- Keine echte OpenAI-Anfrage: Ersatzkey und projektspezifischer Modellzugriff fehlen.
  Proxy, Consent, Budgetreservierung, Cache und transparenter Fallback sind implementiert.
- Stripe/StoreKit sind implementierte Integrationen. Reale Sandbox-Käufe, Restore,
  abgebrochene Zahlungen, Refunds und Serverbenachrichtigungen mit Händlerkonfiguration
  müssen vor Freischaltung durchgespielt werden. Lokale Zustands-/Signaturfehler-Tests
  ersetzen diese Prüfung nicht.
- 24-Tage-Trial ist serverbasiert; iOS-Neukonten warten auf die signierte kostenlose
  Trial-Transaktion. Kein automatisches Abo. Kontingente begrenzen Kosten.
- App Store Connect bleibt in der separaten bisherigen Swift-App. Keine Portierung
  ihres privaten Berichtdownloads auf Windows/iOS; keine automatisch versandten Berichte.
- Hosting/Backups, E-Mail-Verifikation/Recovery, Betreibername/Adresse, Rechtsfreigabe,
  Markenprüfung, Signierung/Notarisierung und Store-Review bleiben Voraussetzungen.

Die Quellarchive enthalten keine Datenbanken, Session-Dateien, Providerkeys oder
node_modules. Entwicklungsdaten und Prüfprotokolle liegen ausserhalb des Quellarchivs.
