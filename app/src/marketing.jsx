import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe,
  Search,
  ChartNoAxesCombined,
  Users,
  Sparkles,
  ShieldCheck,
  Sun,
  Plus,
  ArrowDownToLine,
  Command,
  MousePointer2,
  Layers,
  Mail,
  Download,
  Apple,
  Monitor,
  Smartphone,
  LayoutDashboard,
} from "lucide-react";
import { Brand, Button, Chart, AppIcon } from "./components";
import { LocaleProvider, useLocale } from "./i18n";
import { demoWorkspace } from "./demo.mjs";
const sample = demoWorkspace().projects[0];
export function Marketing({ locale = "en", page = "home" }) {
  return (
    <LocaleProvider initial={locale}>
      <MarketingBody page={page} />
    </LocaleProvider>
  );
}
function MarketingBody({ page }) {
  const { tr, locale } = useLocale();
  const [menu, setMenu] = useState(false);
  const link = (p) => `/${locale}${p === "home" ? "" : "/" + p}`;
  return (
    <div className="marketing">
      <a href="#content" className="skip">
        {tr("Skip to content", "Zum Inhalt")}
      </a>
      <header className="site-header">
        <a href={link("home")}>
          <Brand />
        </a>
        <nav
          className={menu ? "open" : ""}
          aria-label={tr("Main navigation", "Hauptnavigation")}
        >
          <a href={link("home") + "#product"}>{tr("Product", "Produkt")}</a>
          <a href={link("home") + "#how"}>
            {tr("How it works", "So funktioniert’s")}
          </a>
          <a href={link("home") + "#pricing"}>{tr("Pricing", "Preis")}</a>
          <a href={link("support")}>{tr("Support", "Support")}</a>
        </nav>
        <div className="site-actions">
          <a
            className="locale-button"
            href={`/${locale === "en" ? "de" : "en"}${page === "home" ? "" : "/" + page}`}
          >
            <Globe size={14} />
            {locale.toUpperCase()}
          </a>
          <a className="site-login" href="/app/">
            {tr("Sign in", "Anmelden")}
          </a>
          <a className="button" href="/app/">
            {tr("Explore Rankwisp", "Rankwisp entdecken")}{" "}
            <ArrowUpRight size={14} />
          </a>
          <button
            className="icon-button site-menu"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-label={tr("Toggle navigation", "Navigation umschalten")}
          >
            <ChevronDown size={20} />
          </button>
        </div>
      </header>
      <main id="content">
        {page === "home" ? (
          <>
            <section className="hero">
              <img
                className="hero-mascot"
                src="/wisp.svg"
                width="240"
                height="215"
                alt=""
              />
              <div className="hero-eyebrow">
                <span />
                <span>
                  {tr(
                    "A little clarity. A lot of possibility.",
                    "Ein klarer Blick. Neue Möglichkeiten.",
                  )}
                </span>
              </div>
              <h1>
                {tr("Your app has potential.", "Deine App hat Potenzial.")}
                <br />
                <em>{tr("Make it visible.", "Mach es sichtbar.")}</em>
              </h1>
              <p>
                {tr(
                  "Meet the calmer way to grow on the App Store. Understand your rankings, find the right comparisons, and turn real signals into your next good move.",
                  "Entdecke den entspannten Weg zu mehr Sichtbarkeit im App Store. Verstehe deine Rankings, finde passende Vergleiche und leite aus echten Signalen deinen nächsten Schritt ab.",
                )}
              </p>
              <div className="hero-actions">
                <a className="button large" href="/app/">
                  {tr(
                    "Find your app’s next move",
                    "Finde den nächsten Schritt",
                  )}{" "}
                  <ArrowUpRight size={18} />
                </a>
                <a className="button ghost large" href="/app/?demo=1">
                  {tr("Take a look inside", "Schau hinein")}{" "}
                  <ArrowRight size={16} />
                </a>
              </div>
              <div className="hero-reassurance">
                <span>
                  <Check size={13} />
                  {tr("24 days to explore", "24 Tage entdecken")}
                </span>
                <span>
                  <Check size={13} />
                  {tr("No card needed", "Ohne Kreditkarte")}
                </span>
                <span>
                  <Check size={13} />
                  {tr("One-time purchase", "Einmaliger Kauf")}
                </span>
              </div>
              <div className="product-stage" id="product">
                <div className="stage-label">
                  <span className="small-label">
                    RANKWISP / {tr("WORKSPACE", "ARBEITSBEREICH")}
                  </span>
                  <span>
                    {tr(
                      "An illustrative look inside",
                      "Ein illustrativer Einblick",
                    )}
                  </span>
                </div>
                <ProductPreview />
                <div className="stage-bottom">
                  <span>
                    <ShieldCheck size={14} />
                    {tr(
                      "Fictional example data. Real interface.",
                      "Fiktive Beispieldaten. Echte Oberfläche.",
                    )}
                  </span>
                  <a href="/app/?demo=1">
                    {tr(
                      "Explore the interactive preview",
                      "Interaktive Vorschau öffnen",
                    )}{" "}
                    <ArrowUpRight size={14} />
                  </a>
                </div>
              </div>
              <div className="platform-line">
                <span>
                  {tr(
                    "Built around your workflow.",
                    "Für deinen Arbeitsalltag.",
                  )}
                </span>
                <span>
                  <Monitor size={17} />
                  macOS
                </span>
                <span>
                  <Layers size={17} />
                  Windows
                </span>
                <span>
                  <Smartphone size={17} />
                  iOS
                </span>
                <a href={link("downloads")}>
                  {tr("See build availability", "Build-Verfügbarkeit ansehen")}{" "}
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </section>
            <section className="clarity-section site-section">
              <div className="section-intro">
                <span className="eyebrow">
                  {tr(
                    "LESS GUESSWORK. MORE GOOD DECISIONS.",
                    "WENIGER VERMUTUNGEN. BESSERE ENTSCHEIDUNGEN.",
                  )}
                </span>
                <h2>
                  {tr("The signal you need.", "Die Signale, die du brauchst.")}
                  <br />
                  <em>{tr("Room to think.", "Raum zum Nachdenken.")}</em>
                </h2>
                <p>
                  {tr(
                    "You don’t need another wall of numbers. You need to know what changed, what it means, and where to look next.",
                    "Du brauchst keine weitere Zahlenwand. Du möchtest wissen, was sich verändert hat, was es bedeutet und wo du genauer hinschauen solltest.",
                  )}
                </p>
              </div>
              <div className="feature-editorial">
                <article>
                  <div className="feature-number">
                    01 <Search size={19} />
                  </div>
                  <h3>
                    {tr(
                      "Find the searches that matter.",
                      "Finde die Suchbegriffe, die zählen.",
                    )}
                  </h3>
                  <p>
                    {tr(
                      "Track real App Store search positions across storefronts. Keep the context, the history, and even the gaps.",
                      "Beobachte echte App-Store-Suchpositionen in verschiedenen Ländern. Behalte Kontext, Verlauf und auch die Lücken.",
                    )}
                  </p>
                </article>
                <article>
                  <div className="feature-number">
                    02 <Users size={19} />
                  </div>
                  <h3>
                    {tr(
                      "Choose a meaningful comparison.",
                      "Wähle einen sinnvollen Vergleich.",
                    )}
                  </h3>
                  <p>
                    {tr(
                      "Discover apps that show up for the same searches. See why they were suggested, then make the selection your own.",
                      "Entdecke Apps in denselben Suchergebnissen. Verstehe die Vorschläge und passe deine Auswahl an.",
                    )}
                  </p>
                </article>
                <article>
                  <div className="feature-number">
                    03 <Sparkles size={19} />
                  </div>
                  <h3>
                    {tr(
                      "Leave with a useful next step.",
                      "Finde einen nützlichen nächsten Schritt.",
                    )}
                  </h3>
                  <p>
                    {tr(
                      "Optional AI turns your observations into concise ideas. Every suggestion is a hypothesis you can inspect and test.",
                      "Optionale KI macht aus deinen Messungen kurze Ideen. Jeder Vorschlag ist eine Hypothese, die du prüfen und testen kannst.",
                    )}
                  </p>
                </article>
              </div>
            </section>
            <section className="how-section site-section" id="how">
              <div className="section-intro">
                <span className="eyebrow">
                  {tr(
                    "FROM SEARCH TO PERSPECTIVE",
                    "VON DER SUCHE ZUM ÜBERBLICK",
                  )}
                </span>
                <h2>
                  {tr("A gentle start.", "Ein einfacher Einstieg.")}
                  <br />
                  <em>{tr("A useful habit.", "Eine nützliche Gewohnheit.")}</em>
                </h2>
              </div>
              <div className="how-grid">
                <div className="onboarding-illustration">
                  <div className="tiny-window">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="illustration-search">
                    <Search size={18} />
                    <span>{tr("Find your app…", "Finde deine App…")}</span>
                    <kbd>↵</kbd>
                  </div>
                  <div className="illustration-result">
                    <AppIcon size={48} />
                    <div>
                      <strong>Daylight</strong>
                      <span>
                        {tr(
                          "Illustrative app · Productivity",
                          "Beispiel-App · Produktivität",
                        )}
                      </span>
                    </div>
                    <span className="selected-check">
                      <Check size={16} />
                    </span>
                  </div>
                  <div className="illustration-result muted-result">
                    <span className="abstract-app lavender">
                      <Layers size={22} />
                    </span>
                    <div>
                      <strong>Daily Ritual</strong>
                      <span>
                        {tr(
                          "Suggested comparison",
                          "Vorgeschlagener Vergleich",
                        )}
                      </span>
                    </div>
                    <Plus size={17} />
                  </div>
                  <p className="small muted">
                    {tr(
                      "You choose what belongs in your workspace.",
                      "Du entscheidest, was in deinen Arbeitsbereich gehört.",
                    )}
                  </p>
                </div>
                <div className="how-steps">
                  {[
                    [
                      tr("Find your app", "Finde deine App"),
                      tr(
                        "Search by name, App Store link or ID. Pick your storefront.",
                        "Suche nach Name, App-Store-Link oder ID. Wähle dein Store-Land.",
                      ),
                    ],
                    [
                      tr(
                        "Set your frame of reference",
                        "Wähle deinen Vergleichsrahmen",
                      ),
                      tr(
                        "Review a few competitor suggestions and add relevant keywords.",
                        "Prüfe einige Konkurrenzvorschläge und ergänze relevante Keywords.",
                      ),
                    ],
                    [
                      tr(
                        "Measure, learn, make a move",
                        "Messen, lernen, handeln",
                      ),
                      tr(
                        "Follow your observations over time. Choose one small improvement to test.",
                        "Verfolge deine Messungen über die Zeit. Teste eine kleine Verbesserung.",
                      ),
                    ],
                  ].map(([title, text], i) => (
                    <article key={i}>
                      <span>0{i + 1}</span>
                      <div>
                        <h3>{title}</h3>
                        <p>{text}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
            <section className="trust-strip site-section">
              <ShieldCheck size={30} />
              <div>
                <h2>
                  {tr(
                    "Clarity includes what we don’t know.",
                    "Klarheit heisst auch: Grenzen kennen.",
                  )}
                </h2>
                <p>
                  {tr(
                    "No invented search volume. No made-up downloads. No opaque market-share claims. Apple API observations are labelled, and missing data stays missing.",
                    "Keine erfundenen Suchvolumen. Keine ausgedachten Downloads. Keine unklaren Marktanteile. Apple-API-Messungen sind gekennzeichnet, und fehlende Daten bleiben fehlend.",
                  )}
                </p>
              </div>
            </section>
            <section className="pricing-section site-section" id="pricing">
              <div className="section-intro">
                <span className="eyebrow">
                  {tr(
                    "LESS COMMITMENT. MORE CLARITY.",
                    "WENIGER VERPFLICHTUNG. MEHR KLARHEIT.",
                  )}
                </span>
                <h2>
                  {tr("Give it 24 days.", "Gib dir 24 Tage.")}
                  <br />
                  <em>{tr("Then make it yours.", "Dann entscheide dich.")}</em>
                </h2>
                <p>
                  {tr(
                    "Explore at your own pace. Your trial never turns into an automatic payment. Your history stays readable and exportable.",
                    "Entdecke in deinem Tempo. Deine Testphase wird nie automatisch kostenpflichtig. Dein Verlauf bleibt lesbar und exportierbar.",
                  )}
                </p>
                <p className="small muted">
                  {tr(
                    "Proposed launch pricing. Purchases are not open in this preview. Final tax-inclusive pricing and terms must be confirmed before launch.",
                    "Vorgesehener Einführungspreis. In dieser Vorschau sind Käufe noch nicht geöffnet. Endpreis inklusive Steuern und Bedingungen werden vor dem Start bestätigt.",
                  )}
                </p>
              </div>
              <div className="pricing-card">
                <div className="pricing-top">
                  <Brand compact />
                  <span className="pill">
                    {tr("ONE-TIME LICENCE", "EINMALIGE LIZENZ")}
                  </span>
                </div>
                <div className="price">
                  <span>CHF</span>49<small>{tr("once", "einmalig")}</small>
                </div>
                <p>
                  {tr(
                    "A calmer toolkit for independent app makers.",
                    "Ein übersichtliches Werkzeug für unabhängige App-Entwickler.",
                  )}
                </p>
                <ul>
                  <li>
                    <Check size={15} />
                    {tr(
                      "16 MB of workspace history",
                      "16 MB für deinen Verlauf",
                    )}
                  </li>
                  {[
                    tr(
                      "24-day free trial · 120 cloud checks",
                      "24 Tage kostenlos · 120 Cloud-Abfragen",
                    ),
                    tr(
                      "Keyword history and chosen comparisons",
                      "Keyword-Verlauf und gewählte Vergleiche",
                    ),
                    tr(
                      "5,000 total cloud checks with purchase",
                      "Insgesamt 5’000 Cloud-Abfragen mit Kauf",
                    ),
                    tr(
                      "100 total AI notes, with a cost cap",
                      "Insgesamt 100 KI-Hinweise mit Kostenlimit",
                    ),
                    tr(
                      "Full export, even after your trial",
                      "Vollständiger Export, auch nach der Testphase",
                    ),
                  ].map((t) => (
                    <li key={t}>
                      <Check size={16} />
                      {t}
                    </li>
                  ))}
                </ul>
                <a href="/app/" className="button">
                  {tr(
                    "Explore the preview",
                    "Vorschau entdecken",
                  )}{" "}
                  <ArrowRight size={16} />
                </a>
                <small>
                  {tr(
                    "Purchase totals include trial usage. Cloud quotas are finite; no unlimited lifetime API access.",
                    "Kaufkontingente enthalten die Testnutzung. Cloud-Kontingente sind begrenzt; kein unbegrenzter lebenslanger API-Zugriff.",
                  )}
                </small>
              </div>
            </section>
            <section className="faq-section site-section">
              <div className="section-intro">
                <span className="eyebrow">
                  {tr("A FEW GOOD QUESTIONS", "EIN PAAR GUTE FRAGEN")}
                </span>
                <h2>{tr("A little more context.", "Etwas mehr Kontext.")}</h2>
              </div>
              <div className="faq-list">
                {[
                  [
                    tr(
                      "Where does the data come from?",
                      "Woher kommen die Daten?",
                    ),
                    tr(
                      "App metadata and search positions come from Apple’s public Search API. The returned order can differ from an iPhone search. Retrieval time and missing results are retained.",
                      "App-Metadaten und Suchpositionen stammen aus Apples öffentlicher Search API. Die Reihenfolge kann von einer iPhone-Suche abweichen. Abrufzeit und fehlende Treffer bleiben dokumentiert.",
                    ),
                  ],
                  [
                    tr(
                      "What happens after 24 days?",
                      "Was passiert nach 24 Tagen?",
                    ),
                    tr(
                      "New tracking requires a licence. Your saved history remains readable and exportable. Nothing is automatically charged or deleted.",
                      "Neue Messungen benötigen eine Lizenz. Dein gespeicherter Verlauf bleibt lesbar und exportierbar. Nichts wird automatisch abgebucht oder gelöscht.",
                    ),
                  ],
                  [
                    tr(
                      "Does AI get my account or payment details?",
                      "Erhält die KI meine Konto- oder Zahlungsdaten?",
                    ),
                    tr(
                      "No. With your permission, it receives the selected project’s app names, keywords and recent ranking observations. AI is optional and uses a server-side provider connection.",
                      "Nein. Mit deiner Einwilligung erhält sie App-Namen, Keywords und letzte Rangmessungen des gewählten Projekts. KI ist optional und nutzt eine serverseitige Anbindung.",
                    ),
                  ],
                  [
                    tr(
                      "Are all platforms available to download?",
                      "Kann ich bereits alle Plattformen herunterladen?",
                    ),
                    tr(
                      "Not yet. This is a private development preview. Native macOS, Windows and iOS packaging is part of the project, but public installers appear only after platform validation and signing.",
                      "Noch nicht. Dies ist eine private Entwicklungsvorschau. Native macOS-, Windows- und iOS-Pakete gehören zum Projekt. Öffentliche Installer folgen erst nach Plattformprüfung und Signierung.",
                    ),
                  ],
                  [
                    tr(
                      "Can I bring my Rankblick history?",
                      "Kann ich meinen Rankblick-Verlauf übernehmen?",
                    ),
                    tr(
                      "Yes. Select a JSON export, review the import counts and confirm. Histories, archives, errors and missing ranks are preserved. Your source file is unchanged. App Store Connect reports stay in the original application.",
                      "Ja. Wähle einen JSON-Export, prüfe die Importübersicht und bestätige. Verläufe, Archive, Fehler und fehlende Ränge bleiben erhalten. Die Quelldatei bleibt unverändert. App-Store-Connect-Berichte bleiben in der ursprünglichen Anwendung.",
                    ),
                  ],
                ].map(([q, a]) => (
                  <details key={q}>
                    <summary>
                      {q}
                      <Plus size={18} />
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>
            <section className="closing-section">
              <Sun size={34} />
              <h2>
                {tr(
                  "Your next good move starts with a clearer view.",
                  "Dein nächster guter Schritt beginnt mit einem klaren Blick.",
                )}
              </h2>
              <a href="/app/" className="button light large">
                {tr("Meet Rankwisp", "Rankwisp kennenlernen")}{" "}
                <ArrowUpRight size={18} />
              </a>
            </section>
          </>
        ) : (
          <InfoPage page={page} />
        )}
      </main>
      <footer className="site-footer">
        <div>
          <a href={link("home")}>
            <Brand />
          </a>
          <p>
            {tr(
              "A clearer view. A better next move.",
              "Ein klarer Blick. Ein guter nächster Schritt.",
            )}
          </p>
          <span className="small muted">
            © {new Date().getFullYear()} Rankwisp ·{" "}
            {tr(
              "Working brand, preview",
              "Arbeitsmarke, Vorschau",
            )}
          </span>
        </div>
        <div>
          <a href={link("downloads")}>
            {tr("Platforms & downloads", "Plattformen & Downloads")}
          </a>
          <a href={link("support")}>Support</a>
          <a href={link("privacy")}>{tr("Privacy", "Datenschutz")}</a>
          <a href={link("terms")}>{tr("Terms", "Bedingungen")}</a>
          <a href={link("legal")}>{tr("Legal notice", "Impressum")}</a>
        </div>
      </footer>
    </div>
  );
}
function ProductPreview() {
  const { tr } = useLocale();
  return (
    <div className="product-preview">
      <aside>
        <Brand />
        <div className="preview-project">
          <AppIcon size={30} />
          <span>
            Daylight<small>US App Store</small>
          </span>
          <ChevronDown size={12} />
        </div>
        {[
          [LayoutDashboard, tr("Overview", "Übersicht")],
          [Search, "Keywords"],
          [ChartNoAxesCombined, tr("Rank history", "Ranking-Verlauf")],
          [Users, tr("Competitors", "Konkurrenz")],
          [Sparkles, tr("Next moves", "Nächste Schritte")],
        ].map(([Icon, title], i) => (
          <div className={"preview-nav " + (!i ? "active" : "")} key={title}>
            <Icon size={14} />
            {title}
          </div>
        ))}
        <div className="preview-side-bottom">
          <Sun size={15} />
          {tr("A little room to explore.", "Zeit zum Entdecken.")}
        </div>
      </aside>
      <div className="preview-main">
        <header>
          <span>
            {tr("Workspace", "Arbeitsbereich")} /{" "}
            <strong>{tr("Overview", "Übersicht")}</strong>
          </span>
          <span>
            <Globe size={12} /> US
          </span>
        </header>
        <div className="preview-content">
          <div className="preview-heading">
            <div>
              <span className="eyebrow">DAYLIGHT · UNITED STATES</span>
              <h2>
                {tr(
                  "A clearer view of your growth.",
                  "Ein klarer Blick auf deine Entwicklung.",
                )}
              </h2>
              <p>
                {tr(
                  "Small signals. Meaningful progress.",
                  "Kleine Signale. Sichtbare Fortschritte.",
                )}
              </p>
            </div>
            <span className="mini-button">
              <Plus size={12} />
              {tr("Add keyword", "Keyword hinzufügen")}
            </span>
          </div>
          <div className="preview-metrics">
            {[
              [tr("Keywords tracked", "Beobachtete Keywords"), "4"],
              [tr("Top 10 positions", "Top-10-Positionen"), "3"],
              [tr("Moving up", "Aufwärtsbewegungen"), "4"],
              [tr("Data coverage", "Datenabdeckung"), "100%"],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{tr("Illustrative data", "Beispieldaten")}</small>
              </div>
            ))}
          </div>
          <div className="preview-chart-row">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <h3>
                    {tr(
                      "Your visibility, over time",
                      "Deine Sichtbarkeit im Verlauf",
                    )}
                  </h3>
                  <p>daily planner</p>
                </div>
                <span className="pill">30{tr("D", "T")}</span>
              </div>
              <Chart keyword={sample.keywords[0]} illustration />
            </div>
            <div className="preview-next">
              <span>
                <Sparkles size={12} />
                {tr("NEXT MOVE", "NÄCHSTER SCHRITT")}
              </span>
              <ArrowUpRight size={34} />
              <h3>
                {tr(
                  "Small changes. Clearer signals.",
                  "Kleine Änderungen. Klare Signale.",
                )}
              </h3>
              <p>
                {tr(
                  "Pick one keyword. Find one useful experiment.",
                  "Ein Keyword. Ein nützliches Experiment.",
                )}
              </p>
              <span className="mini-button">
                {tr("Take a closer look", "Genauer hinschauen")}{" "}
                <ArrowRight size={12} />
              </span>
            </div>
          </div>
          <div className="preview-table">
            <strong>
              {tr("Keywords to keep an eye on", "Keywords im Blick")}
            </strong>
            {sample.keywords.slice(0, 2).map((k) => (
              <div key={k.id}>
                <span>
                  # <b>{k.text}</b>
                </span>
                <strong>{k.samples.at(-1).rank}</strong>
                <span className="positive">
                  ↗ {k.samples.at(-2).rank - k.samples.at(-1).rank}
                </span>
                <span className="status fresh">
                  <i />
                  {tr("Fresh", "Aktuell")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function InfoPage({ page }) {
  const { tr, locale } = useLocale();
  const title =
    {
      privacy: tr(
        "Privacy, in plain language.",
        "Datenschutz, verständlich erklärt.",
      ),
      terms: tr(
        "Clear terms. No surprises.",
        "Klare Bedingungen. Keine Überraschungen.",
      ),
      legal: tr("Legal notice", "Impressum"),
      support: tr(
        "A little help, when you need it.",
        "Hilfe, wenn du sie brauchst.",
      ),
      downloads: tr(
        "A workspace that goes with you.",
        "Ein Arbeitsbereich, der dich begleitet.",
      ),
    }[page] || "Rankwisp";
  return (
    <section className="info-page site-section">
      <span className="eyebrow">
        RANKWISP / {tr("PRIVATE PREVIEW", "PRIVATE VORSCHAU")}
      </span>
      <h1>{title}</h1>
      {page === "support" ? (
        <>
          <p className="lede">
            {tr(
              "Questions, feedback or a little guidance? Write to us.",
              "Fragen, Feedback oder etwas Unterstützung? Schreib uns.",
            )}
          </p>
          <a className="button" href="mailto:info@zhstudio.ch">
            <Mail size={17} />
            info@zhstudio.ch
          </a>
          <h2>
            {tr(
              "A good support message includes…",
              "Eine hilfreiche Supportnachricht enthält…",
            )}
          </h2>
          <p>
            {tr(
              "Your platform, the action you tried and the error shown. Do not include API keys, passwords or private analytics exports. No response-time guarantee is currently offered.",
              "Deine Plattform, die versuchte Aktion und die angezeigte Fehlermeldung. Sende keine API-Schlüssel, Passwörter oder privaten Analytics-Exporte. Eine feste Antwortzeit wird derzeit nicht zugesichert.",
            )}
          </p>
          <h2>{tr("Lost access?", "Zugang verloren?")}</h2>
          <p>
            {tr(
              "Self-service email recovery is not active in this preview. Contact support; identity verification is required before any account access can be restored.",
              "Automatische E-Mail-Wiederherstellung ist in dieser Vorschau nicht aktiv. Kontaktiere den Support; vor einer Wiederherstellung ist eine Identitätsprüfung erforderlich.",
            )}
          </p>
        </>
      ) : page === "downloads" ? (
        <>
          <p className="lede">
            {tr(
              "Native packages are under validation. No public signed installers are offered yet.",
              "Native Pakete werden geprüft. Es werden noch keine öffentlich signierten Installer angeboten.",
            )}
          </p>
          <div className="platform-cards">
            {[
              [
                Monitor,
                "macOS",
                tr(
                  "Desktop package · signing & notarisation pending",
                  "Desktop-Paket · Signierung & Notarisierung offen",
                ),
              ],
              [
                Layers,
                "Windows",
                tr(
                  "Desktop package · Windows runtime validation pending",
                  "Desktop-Paket · Laufzeitprüfung unter Windows offen",
                ),
              ],
              [
                Smartphone,
                "iOS",
                tr(
                  "Native Xcode project · store submission pending",
                  "Natives Xcode-Projekt · Store-Einreichung offen",
                ),
              ],
            ].map(([Icon, name, detail]) => (
              <article className="panel" key={name}>
                <Icon size={30} />
                <h2>{name}</h2>
                <p>{detail}</p>
                <span className="pill">
                  {tr("Development build", "Entwicklungsbuild")}
                </span>
              </article>
            ))}
          </div>
          <a href="/app/?demo=1" className="button">
            {tr("Open the browser preview", "Browser-Vorschau öffnen")}{" "}
            <ArrowUpRight size={16} />
          </a>
        </>
      ) : page === "privacy" ? (
        <>
          <p className="lede">
            {tr(
              "This is a review draft for the publicly accessible preview. Operator details and processor agreements still require confirmation before commercial use.",
              "Dies ist ein Prüfentwurf für die öffentlich erreichbare Vorschau. Betreiberangaben und Auftragsverarbeitungsverträge müssen vor kommerzieller Nutzung noch bestätigt werden.",
            )}
          </p>
          <h2>{tr("What is stored", "Was gespeichert wird")}</h2>
          <p>
            {tr(
              "When Google sign-in is configured: your Google account identifier and verified email, hashed session records, trial dates, licence and usage counters, selected apps, keywords, observations and import backups. Google access and ID tokens are not retained. Password hashes apply only to the separate local Node version. Local language preference is saved on your device. Session cookies are necessary for sign-in; no advertising cookies are used.",
              "Wenn Google-Anmeldung eingerichtet ist: Google-Kontokennung und bestätigte E-Mail, gehashte Sitzungsdaten, Testbeginn, Lizenz und Nutzungskontingente, gewählte Apps, Keywords, Messungen und Importsicherungen. Google-Zugriffs- und ID-Tokens werden nicht aufbewahrt. Passwort-Hashes betreffen nur die separate lokale Node-Version. Die Sprachwahl wird lokal gespeichert. Sitzungscookies sind zur Anmeldung erforderlich; Werbecookies werden nicht eingesetzt.",
            )}
          </p>
          <h2>{tr("Where requests go", "Wohin Anfragen gehen")}</h2>
          <p>
            {tr(
              "Cloudflare serves this website and API and stores account data using D1 and SQLite Durable Objects; network requests disclose your IP address to Cloudflare. Google handles sign-in when enabled. Apple receives search terms, app IDs and storefront country. App icons load from Apple’s CDN and may expose your IP address to Apple. With your separate permission, OpenAI receives bounded project observations for requested advice. Provider API keys remain on the server. Payment processing will use a configured provider only after launch approval.",
              "Cloudflare stellt Website und API bereit und speichert Kontodaten in D1 und SQLite Durable Objects; dabei erhält Cloudflare deine IP-Adresse. Google übernimmt die Anmeldung, sobald sie aktiviert ist. Apple erhält Suchbegriffe, App-IDs und das Store-Land. App-Icons werden von Apples CDN geladen, wodurch Apple deine IP-Adresse erhält. Mit deiner gesonderten Einwilligung erhält OpenAI begrenzte Projektmessungen für angeforderte Empfehlungen. API-Schlüssel bleiben auf dem Server. Zahlungsabwicklung erfolgt erst nach Freigabe über einen eingerichteten Anbieter.",
            )}
          </p>
          <h2>{tr("Analytics is optional", "Analytics ist optional")}</h2>
          <p>
            {tr(
              "Website telemetry is disabled. Optional product telemetry stores daily aggregate feature counts for 30 days, without app names, keywords, account identifiers, recordings or cross-site tracking. App Store metrics are your project data, not usage telemetry.",
              "Website-Telemetrie ist deaktiviert. Optionale Produkt-Telemetrie speichert tägliche aggregierte Funktionsaufrufe für 30 Tage, ohne App-Namen, Keywords, Konto-IDs, Aufzeichnungen oder websiteübergreifendes Tracking. App-Store-Messwerte sind deine Projektdaten und keine Nutzungstelemetrie.",
            )}
          </p>
          <h2>
            {tr("Your choices and retention", "Deine Wahl und Aufbewahrung")}
          </h2>
          <p>
            {tr(
              "Export your workspace at any time, withdraw AI/telemetry consent, or delete your account in Settings. Sessions expire after seven days; API cache expires after seven days. Workspace data and import recovery copies remain until you delete the account. Expired trials are not deleted automatically. Statutory payment retention, provider retention and international transfer safeguards require final disclosure before launch.",
              "Exportiere jederzeit deinen Arbeitsbereich, widerrufe KI-/Telemetrie-Einwilligungen oder lösche dein Konto in den Einstellungen. Sitzungen laufen nach sieben Tagen ab; API-Caches nach sieben Tagen. Arbeitsbereich und Importsicherungen bleiben bis zur Kontolöschung erhalten. Abgelaufene Testphasen werden nicht automatisch gelöscht. Gesetzliche Zahlungsaufbewahrung, Anbieterfristen und Schutz bei internationalen Übermittlungen müssen vor dem Start abschliessend ausgewiesen werden.",
            )}
          </p>
          <p>
            {tr(
              "Contact for access, correction and deletion requests:",
              "Kontakt für Auskunft, Berichtigung und Löschung:",
            )}{" "}
            <a href="mailto:info@zhstudio.ch">info@zhstudio.ch</a>.
          </p>
        </>
      ) : page === "terms" ? (
        <>
          <p className="notice">
            {tr(
              "Review draft. Purchasing is disabled until the merchant details, final terms, taxes and consumer-rights flow have been approved.",
              "Entwurf zur Prüfung. Käufe bleiben deaktiviert, bis Händlerangaben, endgültige Bedingungen, Steuern und Verbraucherrechte freigegeben sind.",
            )}
          </p>
          <h2>{tr("The product", "Das Produkt")}</h2>
          <p>
            {tr(
              "Rankwisp helps observe App Store search positions and compare selected apps. Results are observations of Apple API responses, not guarantees of app-store placement, business performance or revenue. Recommendations require your judgement.",
              "Rankwisp beobachtet App-Store-Suchpositionen und vergleicht ausgewählte Apps. Ergebnisse sind Beobachtungen von Apple-API-Antworten, keine Zusicherungen von Platzierung, Geschäftserfolg oder Umsatz. Empfehlungen benötigen deine Prüfung.",
            )}
          </p>
          <h2>
            {tr("Trial and purchase proposal", "Testphase und Kaufvorschlag")}
          </h2>
          <p>
            {tr(
              "The free trial lasts 24 consecutive days from activation: server-side account creation on the web, or the verified free-trial StoreKit transaction on iOS. No automatic charge follows. Proposed purchase: CHF 49 once, with 5,000 total cloud check attempts and 100 total AI notes including trial usage; additionally subject to the disclosed AI cost allowance. Software licence is perpetual for the purchased release. Future major versions, indefinite hosting and unlimited API access are not promised. Final consumer price and tax handling must be confirmed before sale.",
              "Die kostenlose Testphase dauert 24 aufeinanderfolgende Tage ab Aktivierung: serverseitige Kontoerstellung im Web oder verifizierte kostenlose StoreKit-Testtransaktion unter iOS. Es erfolgt keine automatische Abbuchung. Kaufvorschlag: einmalig CHF 49 mit insgesamt 5’000 Cloud-Abrufversuchen und 100 KI-Hinweisen inklusive Testnutzung; zusätzlich begrenzt durch das offengelegte KI-Kostenbudget. Die Softwarelizenz gilt dauerhaft für die gekaufte Version. Künftige Hauptversionen, unbegrenztes Hosting und unbegrenzter API-Zugriff werden nicht zugesichert. Endpreis und Steuerabwicklung müssen vor Verkauf bestätigt werden.",
            )}
          </p>
          <h2>{tr("Data and service limits", "Daten und Dienstgrenzen")}</h2>
          <p>
            {tr(
              "You may read and export saved data after the trial. New observations require an active trial or licence and remaining quotas. Provider outages and limits can delay observations. Missing days are not fabricated. You control keyword and competitor selection.",
              "Du kannst gespeicherte Daten nach der Testphase lesen und exportieren. Neue Messungen benötigen eine aktive Testphase oder Lizenz und verbleibende Kontingente. Anbieterausfälle und Limits können Messungen verzögern. Fehlende Tage werden nicht erfunden. Du bestimmst Keywords und Konkurrenz-Auswahl.",
            )}
          </p>
          <h2>
            {tr(
              "Consumer rights and refunds",
              "Verbraucherrechte und Erstattungen",
            )}
          </h2>
          <p>
            {tr(
              "Mandatory consumer rights remain applicable. No waiver of withdrawal rights is collected in this preview. Applicable withdrawal information, model form, refund process and store-specific terms must be completed for the actual markets before checkout is enabled.",
              "Zwingende Verbraucherrechte gelten weiterhin. In dieser Vorschau wird kein Verzicht auf Widerrufsrechte eingeholt. Anwendbare Widerrufsinformationen, Musterformular, Erstattungsprozess und Store-Bedingungen müssen für die tatsächlichen Absatzmärkte vor Checkout-Freigabe ergänzt werden.",
            )}
          </p>
          <p>
            {tr("Questions:", "Fragen:")}{" "}
            <a href="mailto:info@zhstudio.ch">info@zhstudio.ch</a>
          </p>
        </>
      ) : (
        <>
          <p className="lede">
            {tr(
              "Rankwisp is a working brand with a publicly accessible development preview.",
              "Rankwisp ist eine Arbeitsmarke mit öffentlich erreichbarer Entwicklungsvorschau.",
            )}
          </p>
          <h2>Support</h2>
          <a href="mailto:info@zhstudio.ch">info@zhstudio.ch</a>
          <h2>
            {tr("Operator details pending", "Betreiberangaben noch offen")}
          </h2>
          <p>
            {tr(
              "The legal operator’s name, service address, legal form and any required registration/tax details have not yet been supplied. They must be completed and reviewed before commercial launch or sales. No company or address is inferred from the support email.",
              "Name des rechtlichen Betreibers, Geschäftsadresse, Rechtsform und erforderliche Register-/Steuerangaben wurden noch nicht bereitgestellt. Sie müssen vor kommerziellem Start oder Verkauf ergänzt und geprüft werden. Aus der Support-E-Mail werden keine Firma oder Adresse abgeleitet.",
            )}
          </p>
          <h2>{tr("Independent product", "Unabhängiges Produkt")}</h2>
          <p>
            {tr(
              "Rankwisp is not affiliated with or endorsed by Apple or OpenAI. App Store names and app artwork belong to their respective owners and link to their store listings.",
              "Rankwisp ist nicht mit Apple oder OpenAI verbunden oder von ihnen unterstützt. App-Store-Namen und App-Grafiken gehören ihren jeweiligen Rechteinhabern und verlinken auf die Store-Einträge.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
