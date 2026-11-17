# Preis, Kosten und Launch-Abhängigkeiten

Stand: 17. November 2026. Empfehlung zur Prüfung: **CHF 49 einmalig**, 24 Tage
kostenlos, keine Karte zur Web-Testphase und keine automatische Umwandlung in einen Kauf.
Englische Basis und deutsche Oberfläche; weitere Sprachen über die Locale-Abstraktion.

## Konkreter Leistungsumfang

- Test: 120 Cloud-Abrufversuche und bis zu 8 KI-Hinweise, zusätzlich USD 0.16 KI-Budget.
- Kauf: insgesamt 5’000 Cloud-Abrufversuche und bis zu 100 KI-Hinweise inkl. Testnutzung,
  zusätzlich USD 2 KI-Budget. Ein stärkeres Modell kann das Budget früher ausschöpfen.
- Eine erfolglose Apple-Abfrage zählt als Versuch, erzeugt aber keinen falschen Messpunkt.
- 10 Apps/Stores, je 50 aktive Keywords; importierte ältere Archive/Verläufe bleiben bestehen.
- Softwarelizenz für die gekaufte Version dauerhaft. Keine Zusage für unbegrenztes Hosting,
  künftige Hauptversionen oder unbegrenzten API-Verbrauch. Keine automatische Nachbelastung.
- Nach Ablauf: Lesen, Export, Importsicherungen und Kontolöschung weiter verfügbar.
- 5’000 Abrufe reichen beispielsweise für 10 täglich gemessene Keywords 500 Tage,
  oder 50 Keywords 100 Tage; manuelle Versuche verringern diese Laufzeit entsprechend.
  Deshalb Kontingente sichtbar halten und vor Verkauf bewusst freigeben.

## Modellstrategie und Rechenbasis

Der Nutzer bestätigte „Luna“. Die offizielle Modellseite nennt `gpt-6-luna` als API-ID,
Responses-Unterstützung und Standardpreise USD 0.10 Input / USD 0.50 Output je 1 Mio.
Tokens (kurzer Kontext). Quelle: https://developers.openai.com/api/docs/models/gpt-6-luna
Die Konfiguration darf nicht aus Codex-Modellnamen abgeleitet werden.

Beispiel ohne Cache: 3’000 Input- und 700 Output-Tokens kosten nach dieser Preistabelle
USD 0.00065; 100 solcher Antworten etwa USD 0.065. Dies ist eine Rechenannahme,
keine Messung tatsächlicher Abrechnung. Längere Eingaben, Preisänderungen, Reasoning
und andere Modelle verändern die Kosten. Der Server reserviert deshalb konservativ
USD 0.02 pro Standard-Anfrage und USD 0.12 für das stärkere Entscheidungsmodell.
Er reserviert atomar **vor** dem Provideraufruf. Unklare Fehler werden nicht automatisch
wiederholt; ihre Reservierung bleibt bestehen. Globales Standardbudget USD 20 über die
Lebensdauer der Datenbank; kein automatischer monatlicher Reset. Provider-Projektlimit
zusätzlich setzen. Kein Live-Aufruf mit einem echten OpenAI-Key wurde ausgeführt.

Standard: Luna, `reasoning.effort=none`, max. 700 Output-Tokens. Optionales stärkeres
Modell: `gpt-6.1-sol`, explizite Nutzerwahl, `low`; kein automatisches Upgrade.
Die Anwendung sendet keine E-Mail, Passwörter oder Zahlungsdaten. Caches sind mandanten-
und eingabebezogen. Eingaben aus App-Metadaten sind untrusted data.

### Konservative Kalkulation je Verkauf

Bewusst modellierte Annahmen, keine Behauptung tatsächlich geltender Steuern/Gebühren.
Für die Planung wird USD = CHF angenommen, ohne Wechselkursprognose.

| Position | Direkter Verkauf | Store-Szenario |
| --- | ---: | ---: |
| Verkaufspreis brutto | 49.00 | 49.00 |
| Nach angenommener 10%-Steuerkomponente | 44.55 | 44.55 |
| Gebührenreserve: 3% + 0.30 / 15% vom Bruttopreis | −1.77 | −7.35 |
| Maximale enthaltene KI-Reserve | −2.00 | −2.00 |
| Hosting/Storage-Anteil, Planung | −5.00 | −5.00 |
| Support-/Wartungsreserve, Planung | −8.00 | −8.00 |
| Deckungsbeitrag vor Entwicklung/Fixkosten | **27.78** | **22.20** |

Apple Small Business 15% setzt Aufnahme/Berechtigung voraus; nicht automatisch unterstellen.
Ein 30%-Szenario reduziert die letzte Zeile auf CHF 14.85. Stripe-Gebühren hängen von
Karte, Währung und Zahlungsweg ab; die 3%-Annahme ist keine Preiszusage.
Quellen: https://stripe.com/ch/pricing und https://developer.apple.com/app-store/small-business-program/

Ein kleiner Einmalkauf trägt keine unendlichen Serverkosten. Vor öffentlichem Verkauf
Hostingdauer/-Betrieb und Offline-Nutzbarkeit verbindlich festlegen; derzeit ist für neue
Messungen und das Kontowerk eine Serververbindung erforderlich. Exportdateien bleiben
portabel. Bei nachhaltigem Betrieb Zusatzkontingente nur als separaten bewussten Kauf
prüfen; in diesem Stand gibt es weder Abo noch automatische Top-ups.

## Kaufwege

Web und direkt verteiltes macOS/Windows: Stripe Checkout mit serverkonfiguriertem Preis,
`mode=payment`, verifizierten Webhook-Signaturen, Artikel-ID-Prüfung, Idempotenz und
Widerruf bei Refund/Dispute. Eine Checkout-Erfolgsseite gewährt keine Lizenz.

iOS: StoreKit-2-Non-Consumable `ch.zhstudio.rankwisp.lifetime`; Originaltransaktionen
werden serverseitig über Apples Signaturbibliothek mit Trust Roots, Bundle/App-ID,
Umgebung, Produkt-ID und `appAccountToken` geprüft. Kein externer Checkout-Link im
iOS-Kaufablauf. Wiederherstellung synchronisiert StoreKit und den Account. Server
Notifications V2 verarbeiten Widerrufe des bezahlten Produkts. Sandbox und echte
Refund-/Dispute-Reconciliation müssen mit Händlerkonten noch end-to-end geprüft werden.

Für die 24-Tage-Testphase unter iOS Apples kostenloses Non-Consumable IAP **“24-day Trial”**,
ID `ch.zhstudio.rankwisp.trial24`, einrichten. Neu auf iOS registrierte Accounts bleiben
`pending`, bis eine signierte Testtransaktion geprüft wurde. Der Beginn stammt aus der
verifizierten Apple-Kaufzeit und wird durch Replay/Neuinstallation nicht zurückgesetzt.
Web-Accounts starten serverseitig bei Erstellung. Bestehende Accounts können sich auf
iOS anmelden. Keine Abonnements für diesen Zweck einrichten.

Quelle: https://developer.apple.com/app-store/review/guidelines/ (3.1.1 Testphase,
3.1.3(b) Multiplattform). Änderungen je Storefront und spätere Review-Entscheidungen
bleiben zu prüfen. Kein pauschales Versprechen einer App-Store-Zulassung.

## Betreiber und Recht

Bestätigt: **info@zhstudio.ch**. Nicht bekannt: rechtlicher Betreibername,
Geschäftsadresse, Rechtsform, Register-/Steuerstatus, Merchant, Hostingregion,
Vertragsparteien und verbindlicher Erstattungsprozess. Die E-Mail-Domain beweist diese
Angaben nicht. Website enthält deshalb gekennzeichnete Entwürfe; `LEGAL_APPROVED=false`.

Offizielle Ausgangsquellen:
- Schweizer E-Commerce-Pflichten: https://www.kmu.admin.ch/en/statutory-obligations-swiss-and-european-e-commerce-laws
- Schweizer Cookies/ähnliche Technologien: https://www.edoeb.admin.ch/dam/en/sd-web/brLL9rM3ny9d/Leitfaden%20des%20ED%C3%96B%20betreffend%20Datenbearbeitungen%20mittels%20Cookies%20und%20%C3%A4hnlichen%20Technologien%20V.%201.1%20vom%2006.10.2025_EN.pdf
- EU-Verbraucherrechte: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02011L0083-20260927
- Apple API-Bedingungen und ungefähres Limit von 20 Aufrufen/Minute:
  https://performance-partners.apple.com/search-api

Vor Verkauf: Markt-/Steuerprüfung, Preis inklusive anwendbarer Steuern, Vertragstext,
Widerrufsinformation und Musterformular, keine vorangekreuzten Verzichtserklärungen,
Bestellbestätigung auf dauerhaftem Datenträger, Auftragsverarbeitungsverträge,
Transfermechanismen, Lösch-/Aufbewahrungsplan und Datenschutzerklärung fertigstellen.
Zahlungsbelege können gesetzlichen Aufbewahrungspflichten unterliegen; die aktuelle
Preview-Kontolöschung ist noch nicht als steuerliches Belegarchiv ausgelegt.
Rechtliche Prüfung ist eine Launch-Abhängigkeit, keine behauptete Zertifizierung.

Apple-Icons werden in Such-/Vergleichskarten mit App-Store-Links angezeigt; keine Musik-
oder Videovorschauen. Kommerzielle ASO-Auswertung und Aufbewahrung mit Apple abklären,
bevor das Produkt breit vertrieben wird. Der Einzelserver drosselt global auf 3.3 s;
20 Aufrufe/Minute sind keine vertragliche Kapazitätsgarantie. Grösserer Betrieb benötigt
einen zulässigen Datenzugang und eine entsprechende Kapazitätsplanung.
