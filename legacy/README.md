# Rankblick

Native macOS-App zum Beobachten von Keywords in verschiedenen App Stores, für manuelle Abfragen und den Vergleich ihrer Entwicklung über Zeit. Eigenständiger SwiftUI-Code, keine Astro-Abhängigkeit und keine Verwendung von Astros privaten APIs oder Lizenzsystem.

## Verwendung

- **Aktualisieren / ⌘R:** alle aktiven Keywords der gewählten App messen.
- **Aktualisieren im Keyword-Detail:** nur diesen Begriff messen.
- **Hinzufügen +:** neue Begriffe mit Kommas, Semikolon oder Zeilenumbrüchen hinzufügen. Doppelte Begriffe werden nicht erneut angelegt. Bis zu 100 aktive Keywords pro App/Store.
- **App-Auswahl oben → App hinzufügen:** App-Store-URL oder numerische App-ID eingeben. Jeder Store führt einen eigenen Verlauf.
- **Archivieren:** beendet die Beobachtung, behält alle Messpunkte. Unter Keywords → Archiv über das Menü am Keyword wiederherstellen.
- **Einstellungen:** Automatik aktivieren/pausieren, Datenordner öffnen, JSON-Backup exportieren.

## Oberfläche 1.3

Helles Dashboard nach der gelieferten Referenz: beschriftete Navigation mit vier Hauptseiten, abgerundete Karten, klare Ringgrafik für den Konkurrenzvergleich, Messtage-Kalender und kompakte Keyword-Liste. Die fünf Grundfarben sind `#2B2D42`, `#8D99AE`, `#EDF2F4`, `#EF233C` und `#D80032`; Flächen und Verläufe mischen ausschliesslich diese Farben. Native macOS-Fenster- und Systemelemente folgen dem Betriebssystem.

Die Suche auf Keywords filtert die Verwaltungsliste. Ein Klick öffnet Suchergebnisse und Abfragedetails. Zeitreihen und Messprotokoll liegen auf Verlauf. Der Kalender markiert gespeicherte Messtage und den nächsten geplanten Abruf. Ein Tagesklick zeigt die Anzahl tatsächlicher Keyword-Messungen. Die Übersicht zeigt die Verteilung deiner Positionen und die zuletzt beobachteten Änderungen.

## Messmethode

Direkte HTTPS-Abfragen an Apples öffentliche iTunes Search API mit konstanten Parametern `country=<Store>`, `entity=software`, `media=software`, `limit=200`. Die Position ist der einsbasierte Index der App-ID im zurückgegebenen Ergebnisarray. Nicht gefunden ist `null`, niemals ein erfundener Rang 201 oder 1000. Die tatsächliche Ergebnisanzahl und alle zurückgegebenen App-IDs/Namen werden pro Messung gespeichert.

Diese API-Reihenfolge kann von der Suche auf einem iPhone und von Astro abweichen. Ein manueller Abruf ignoriert den lokalen URL-Cache; Apple kann dennoch serverseitig gecachte Daten liefern. Der Zeitstempel bezeichnet den Abrufzeitpunkt, nicht den Entstehungszeitpunkt von Apples Ranking. HTTP Date/Age werden, falls vorhanden, mitgespeichert. Es werden keine Popularity-, Difficulty-, Download- oder Suchvolumenwerte erfunden.

Der mitgelieferte Startdatensatz ist leer und die automatische Aktualisierung zunächst deaktiviert. Er enthält keine privaten Projekte oder Messungen. Neue Projekte werden lokal angelegt; Messpunkte entstehen erst durch tatsächliche API-Abfragen. Die Offline-Tests verwenden ausdrücklich synthetische Fixtures, die nicht als Nutzerdaten ausgeliefert werden.

## Hintergrundbetrieb

Ein benutzerspezifischer LaunchAgent (`ch.yannis.rankblick.refresh`) ruft alle fünf Minuten den mitgelieferten, schlanken `RankblickWorker` mit `--refresh-due` auf. Dieser lädt keine SwiftUI-Oberfläche. Keywords sind nach 23 Stunden 55 Minuten fällig; so beginnt ein normaler täglicher Abruf spätestens ungefähr nach 24 Stunden, solange der Mac wach, angemeldet und online ist. Der Job läuft auch bei beendeter Oberfläche. Die Oberfläche prüft zusätzlich alle 30 Sekunden und bei Aktivierung. Nach Fehlern erfolgt der nächste automatische Versuch frühestens nach 15 Minuten.

Bei Schlaf, ausgeschaltetem Mac, Abmeldung, Netzwerkausfall oder einem von macOS deaktivierten Hintergrundjob sind pünktliche Messungen nicht möglich. Beim nächsten möglichen Lauf werden fällige Keywords abgefragt. Verpasste Tage werden nicht nachträglich erfunden. Für durchgehende Messungen unabhängig vom Mac wäre ein eigener Server nötig.

Ein prozessübergreifendes `flock` verhindert gleichzeitige Abrufläufe. Eine zweite Sperre und atomare Dateiersetzung schützen den Datenspeicher. Anfragen werden prozessübergreifend auf mindestens 3,3 Sekunden Abstand begrenzt (unter Apples dokumentierten ungefähr 20 Anfragen/Minute). HTTP-/JSON-/Netzwerkfehler bleiben Fehler und erzeugen keine „nicht gefunden“-Messpunkte. Erfolgreiche Messungen werden einzeln sofort gespeichert.

## Daten und Wiederherstellung

`~/Library/Application Support/Rankblick/rankblick.json` enthält die Projekte und vollständige Historie. Vor der ersten Änderung eines UTC-Tages wird der vorherige Stand unter `Backups/` gesichert. Backups werden nicht automatisch gelöscht. Keine Telemetrie und keine fremden Analysedienste; Suchbegriffe, Land und App-ID werden für die Abfragen an Apple übertragen.

Zum Wiederherstellen: Automatik in Einstellungen pausieren, Rankblick beenden, die bestehende `rankblick.json` zusätzlich sichern und durch ein exportiertes Backup ersetzen. Danach Rankblick starten und Automatik wieder aktivieren. Beschädigte oder unbekannte Dateiversionen werden nicht stillschweigend überschrieben.

## Bauen

macOS 14+, Apple Silicon und Xcode/Swift 6 Toolchain. Keine externen Pakete.

```sh
./build.sh
# Optional bei veraltetem xcode-select:
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer ./build.sh
```

Das Skript erzeugt `../Rankblick.app`, inklusive Icon und lokaler Ad-hoc-Signatur. Für eine Verteilung an andere Macs sind Developer-ID-Signierung und Notarisierung separat erforderlich. Die lokale App ist für diesen Mac gebaut.

```sh
swift test --build-system native --scratch-path ../../work/rankblick-build
```

CLI für Installation und Diagnose:

```sh
/Applications/Rankblick.app/Contents/MacOS/Rankblick --install-agent
/Applications/Rankblick.app/Contents/MacOS/Rankblick --status
/Applications/Rankblick.app/Contents/MacOS/Rankblick --refresh-now
/Applications/Rankblick.app/Contents/MacOS/Rankblick --refresh-due
/Applications/Rankblick.app/Contents/MacOS/Rankblick --remove-agent
```

Für isolierte Tests lässt sich der Datenordner über `RANKBLICK_DATA_DIR` setzen. Nicht für die normale LaunchAgent-Installation verwenden.

## Quellen

- [Apple Search API](https://performance-partners.apple.com/search-api)
- [Apple: Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)

Die Software ist eine unabhängige Umsetzung mit öffentlicher Schnittstelle.


## Konkurrenz, App-Profile und ASO-Export (1.2)

Über Konkurrenz links öffnest du den Konkurrenzvergleich. Die eigene App ist die Vergleichsbasis; bis zu fünf Konkurrenz-Apps können pro Store hinzugefügt werden. Dieselbe gespeicherte Suchantwort liefert alle App-Positionen, deshalb entstehen keine zusätzlichen Suchabfragen pro Konkurrent. Der historische Vergleich wird aus echten gespeicherten Ergebnislisten abgeleitet, einschliesslich fehlender Treffer. Die Profile (Icons, Version, Veröffentlichungsdatum der aktuellen Version, Beschreibung, Release Notes und Bewertungen) stammen aus Apples öffentlichem ID-Lookup. Icons laden aus Apples Bild-CDN. Profilkarten führen zum App Store.

Manuelles Aktualisieren der ganzen App und der tägliche Hintergrundlauf prüfen auch die Profile. Ein Einzelkeyword-Abruf aktualisiert nur diese Suchantwort. Jeder erfolgreiche Profilabruf wird als Snapshot gespeichert; Fehler erhalten die letzte gültige Version und werden angezeigt. Das Veröffentlichungsdatum unterscheidet sich vom Abrufdatum. Ein lange zurückliegendes Update beweist nicht, dass eine App aufgegeben wurde. Es wird keine vollständige frühere Versionshistorie erfunden.

Der **Sichtbarkeitsanteil** ist ein transparentes Vergleichsmodell: `score(app) = Summe(1 / Rang)` über die aktuellen erfolgreichen Messungen der ausgewählten Keyword-Gruppe, fehlender Treffer = 0. `Anteil = score(app) / Summe(score aller ausgewählten Apps)`. Innerhalb einer Gruppe zählen Keywords gleich; andere Apps ausserhalb der Auswahl sind nicht Teil der 100 %. Sind alle Scores null oder ist keine Konkurrenz gewählt, wird kein Anteil angezeigt. Der Hauptvergleich verwendet nur gemeinsame Funktionen. Marken/Schulportale, Spezialthemen und noch nicht eingeordnete Begriffe sind separat auswählbar. Aktuelle Abruffehler und Messungen älter als 24 h werden ausgeschlossen; die Historie bleibt erhalten. Neue Keywords sind zunächst nicht eingeordnet; die Gruppe lässt sich in den Keyword-Details ändern. Die Auswahl ist eine Research-Hypothese, kein gemessenes Suchvolumen. Der Anteil ist ausdrücklich kein Download-, Nutzer- oder Umsatzmarktanteil. Die Ansicht zeigt Messabdeckung, Abrufzeitraum, Fehler und über 24 Stunden alte Daten. Das Fokus-Keyword `intranet` wird auf der Übersicht separat gezeigt.

Nach **jeder gespeicherten Änderung**, also auch bei automatischen Abrufen, entstehen lokal:

- `~/Library/Application Support/Rankblick/Exports/current-analysis.json`: formatierter Analysebericht, abgeleitete Rankings und Anteile, App-Metadaten, Fehler, Abdeckung und vollständiger Workspace mit allen Messreihen und Trefferlisten.
- `~/Library/Application Support/Rankblick/Exports/current-analysis.txt`: kompakte lesbare Zusammenfassung mit Fokus auf `intranet`.

Daten & Export → Aktuellen Analyse-Export öffnen und „Analyse-Dateien anzeigen“ in den Einstellungen öffnen den Exportordner. Es wird nichts an einen KI-Dienst hochgeladen. Bei Exportfehlern bleiben die Messdaten gespeichert; die Einstellungen zeigen den Fehler. Die JSON-Datenbank bleibt die Quelle der Wahrheit. `AGENTS.md` beschreibt den Ablauf für spätere ASO-Analysen: zuerst den aktuellen Export samt Messdaten-Alter lesen, dann Änderungen vorschlagen. Öffentlich nicht verfügbare Downloads, Nutzerzahlen, Suchvolumina, Conversion, das private Keyword-Feld und lokalisierte Untertitel bleiben unbekannt.

CLI für nachvollziehbares Hinzufügen mit Apple-ID-Prüfung:

```sh
/Applications/Rankblick.app/Contents/MacOS/RankblickWorker --add-competitor OWN_APP_ID COMPETITOR_ID ch
/Applications/Rankblick.app/Contents/MacOS/RankblickWorker --refresh-now
```


## Seitenstruktur und langfristiger Verlauf (1.3)

- **Übersicht:** aktueller Fokus, Positionsverteilung, letzte Änderungen und Datenqualität. Keine vollständige Keyword-Tabelle und kein Konkurrenzdiagramm.
- **Keywords:** Begriffe suchen, hinzufügen, einzeln messen, archivieren und wiederherstellen. Detailansicht mit Trefferliste und Informationen zur letzten Abfrage. Das Archiv ist ein Filter dieser Seite.
- **Verlauf:** grosse Zeitreihe, Keyword-Auswahl (einschliesslich archivierter Begriffe), eigene App oder Konkurrenzkurven, Zeitraum 7/30/90 Tage, ein Jahr oder alle Daten. Dazu Startposition, beste Position, Veränderung und Messprotokoll. Messtage sind hier als Kalender-Popover erreichbar.
- **Konkurrenz:** Sichtbarkeitsanteile, App-Profile, Versionen, Update-Daten und der aktuelle direkte Positionsvergleich. Zeitreihen sind ausschliesslich unter Verlauf.

Weiche Kurven verwenden monotone Interpolation zwischen echten Punkten und lassen sich auf gerade Verbindungen umschalten. Sie erzeugen keine Messwerte. Fehlende Treffer und Zeitabstände über 36 Stunden trennen die Kurve; gleiche Zeitstempel verwenden die zuletzt gespeicherte Antwort. Datumsauswahl zeigt die nächstgelegene echte Messung. Neue Messungen werden sanft eingeblendet, sofern die macOS-Einstellung „Bewegung reduzieren“ nicht aktiv ist. Es werden keine Demo-Messungen in die produktiven Daten eingefügt.


## Keyword-Recherche 1.4

Recherche-Begriffe lassen sich nach gemeinsamen Funktionen, Marken-/Portalbegriffen und Spezialthemen kategorisieren und mit einer Begründung speichern. Exportformat 2 enthält `visibilitySegments` mit den tatsächlich einbezogenen Keyword-Namen; `visibility` ist der Hauptvergleich für gemeinsame Funktionen. Datenbasisänderungen dürfen nicht als organisches Wachstum interpretiert werden. Vorher-/Nachher-Vergleiche benötigen dieselben Keywords, Gruppen, Apps und Gewichte. Die Untersuchung behauptet keine bessere statistische Marktanteilsgenauigkeit.

Strukturierte Recherche lässt sich mit `RankblickWorker --import-keywords FILE.json` atomar importieren. Bestehende IDs, Messpunkte und Archivstatus bleiben bestehen. Schema: `appleID`, `country`, `keywords` mit `text`, `category` (`core`, `brand`, `adjacent`, `unclassified`) und `rationale`.


## Keyword-Rangliste 1.5

Oben auf der Konkurrenzseite zeigt eine visuelle Rangliste die ausgewählten Apps für ein einzelnes Keyword. Standard ist `intranet`; Schnellwahl für `schul intranet`, `absenzen` und `pluspunkte`, alle aktiven Keywords über das Menü. Die führende gefundene App erscheint in einer dunklen Karte, die weiteren Apps folgen nach tatsächlicher Suchposition mit Original-Icons. Die eigene App wird gekennzeichnet. Platz 18 bleibt Platz 18, auch wenn nur vier Apps verglichen werden. Nicht gefundene und ungemessene Apps erhalten keinen Rang. Die Ansicht zeigt den Messzeitpunkt, individuelle Veränderungen, den Abstand zur führenden Vergleichs-App und Warnungen bei veralteten Daten oder Abruffehlern. Die Tabelle ist darunter eingeklappt verfügbar. Ein Klick auf eine App öffnet ihr Profil.
