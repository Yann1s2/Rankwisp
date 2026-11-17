import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe,
  Search,
  ChartNoAxesCombined,
  Users,
  ShieldCheck,
  Plus,
  ArrowDownToLine,
  Mail,
  Download,
  Apple,
  Monitor,
} from "lucide-react";
import { Brand } from "./components";
import { LocaleProvider, useLocale } from "./i18n";
import "./marketing-polish.css";
const RELEASE =
  "https://github.com/Yann1s2/Rankwisp/releases/tag/v0.2.2-preview.1";
const ASSETS =
  "https://github.com/Yann1s2/Rankwisp/releases/download/v0.2.2-preview.1/";
function GoogleAvailability() {
  const { tr } = useLocale();
  const [ready, setReady] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch((import.meta.env.VITE_API_ORIGIN || "") + "/api/config", {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => {
        if (
          !controller.signal.aborted &&
          typeof config?.googleConfigured === "boolean"
        ) {
          setReady(config.googleConfigured);
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);
  return (
    <p className="login-readiness" aria-live="polite">
      {ready === true
        ? tr(
            "Sign in with Google. No additional password needed.",
            "Mit Google anmelden. Kein zusätzliches Passwort nötig.",
          )
        : ready === false
          ? tr(
              "Google sign-in is not available on this server yet. The demo needs no account.",
              "Google-Anmeldung ist auf diesem Server noch nicht verfügbar. Die Demo benötigt kein Konto.",
            )
          : tr(
              "You can explore the demo without an account.",
              "Die Demo ist ohne Konto zugänglich.",
            )}
    </p>
  );
}
function DownloadChoices() {
  const { tr } = useLocale();
  const [platform, setPlatform] = useState(null);
  useEffect(() => {
    const device =
      navigator.userAgentData?.platform ||
      navigator.platform ||
      navigator.userAgent;
    const mobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (/Mac/i.test(device) && navigator.maxTouchPoints > 1);
    setPlatform(
      mobile
        ? "mobile"
        : /Win/i.test(device)
          ? "windows"
          : /Mac/i.test(device)
            ? "mac"
            : "other",
    );
  }, []);
  return (
    <div className="download-choices" data-platform={platform || "unknown"}>
      <p className="download-recommendation" aria-live="polite">
        {platform === "mac"
          ? tr(
              "macOS detected · Apple Silicon build",
              "macOS erkannt · Build für Apple Silicon",
            )
          : platform === "windows"
            ? tr("Windows detected · x64 build", "Windows erkannt · x64-Build")
            : platform === "mobile"
              ? tr(
                  "On mobile? Explore the browser demo, or download for your computer.",
                  "Mobil unterwegs? Öffne die Browser-Demo oder lade die App für deinen Computer.",
                )
              : tr(
                  "Choose your desktop preview",
                  "Wähle deine Desktop-Vorschau",
                )}
      </p>
      <div className="download-buttons">
        <a
          href={ASSETS + "Rankwisp-0.2.2-mac-arm64.zip"}
          className={
            "download-button " + (platform === "mac" ? "recommended" : "")
          }
        >
          <Apple size={23} aria-hidden="true" />
          <span>
            <strong>{tr("Download for Mac", "Für Mac herunterladen")}</strong>
            <small>Apple Silicon · ZIP · 123 MB</small>
          </span>
          <Download size={16} aria-hidden="true" />
        </a>
        <a
          href={ASSETS + "Rankwisp-0.2.2-win.zip"}
          className={
            "download-button " + (platform === "windows" ? "recommended" : "")
          }
        >
          <Monitor size={23} aria-hidden="true" />
          <span>
            <strong>
              {tr("Download for Windows", "Für Windows herunterladen")}
            </strong>
            <small>x64 · ZIP · 154 MB</small>
          </span>
          <Download size={16} aria-hidden="true" />
        </a>
      </div>
      <p className="download-preview-note">
        {tr(
          "v0.2.2-preview.1 · Unsigned development previews. Mac notarisation and Windows runtime validation are pending.",
          "v0.2.2-preview.1 · Unsignierte Entwicklungsvorschauen. Mac-Notarisierung und Windows-Laufzeitprüfung stehen aus.",
        )}{" "}
        <a href={RELEASE}>
          {tr("Release notes & checksums", "Versionshinweise & Prüfsummen")}{" "}
          <ArrowUpRight size={11} aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
function ProductShot({ mobile = true }) {
  const { tr } = useLocale();
  return (
    <figure className="product-shot" id="product">
      <div className="product-shot-heading">
        <span>RANKWISP / {tr("YOUR WORKSPACE", "DEIN ARBEITSBEREICH")}</span>
        <a href="/app/?demo=1">
          {tr("Try the demo", "Demo öffnen")} <ArrowUpRight size={14} />
        </a>
      </div>
      <div className="product-shot-window">
        <span className="window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Rankwisp</span>
        <span>{tr("Development preview", "Entwicklungsvorschau")}</span>
      </div>
      <picture>
        {mobile && (
          <source media="(max-width: 600px)" srcSet="/site/app-mobile.webp" />
        )}
        <img
          src="/site/app-overview.webp"
          width="1440"
          height="900"
          fetchPriority="high"
          alt={tr(
            "Rankwisp overview with keyword positions, ranking history and next steps. Screenshot of the real demo with fictional data.",
            "Rankwisp-Übersicht mit Keyword-Positionen, Ranking-Verlauf und nächsten Schritten. Screenshot der echten Demo mit fiktiven Daten.",
          )}
        />
      </picture>
      <figcaption>
        <span>
          {tr(
            "The real app. Fictional demo data.",
            "Die echte App. Fiktive Demo-Daten.",
          )}
        </span>
        <span>
          {tr(
            "Your data stays yours to export.",
            "Deine Daten bleiben exportierbar.",
          )}
        </span>
      </figcaption>
    </figure>
  );
}

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
  useEffect(() => {
    if (!menu) return;
    const close = (event) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menu]);
  const link = (p) => `/${locale}${p === "home" ? "" : "/" + p}`;
  return (
    <div className="marketing marketing-polished">
      <a href="#content" className="skip">
        {tr("Skip to content", "Zum Inhalt")}
      </a>
      <header className="site-header">
        <a href={link("home")}>
          <Brand />
        </a>
        <nav
          className={menu ? "open" : ""}
          id="marketing-navigation"
          onClick={(event) => {
            if (event.target.closest("a")) setMenu(false);
          }}
          aria-label={tr("Main navigation", "Hauptnavigation")}
        >
          <a href={link("home") + "#product"}>{tr("Product", "Produkt")}</a>
          <a href={link("home") + "#how"}>
            {tr("How it works", "So funktioniert’s")}
          </a>
          <a href={link("downloads")}>{tr("Downloads", "Downloads")}</a>
          <a href={link("home") + "#pricing"}>{tr("Pricing", "Preis")}</a>
          <a href={link("support")}>{tr("Support", "Support")}</a>
          <a
            href="https://github.com/Yann1s2/Rankwisp"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>
        <div className="site-actions">
          <a
            className="locale-button"
            onClick={() => {
              try {
                localStorage.setItem(
                  "rankwisp-language",
                  locale === "en" ? "de" : "en",
                );
              } catch {}
            }}
            href={`/${locale === "en" ? "de" : "en"}${page === "home" ? "" : "/" + page}`}
          >
            <Globe size={14} />
            {locale.toUpperCase()}
          </a>
          <a className="site-login" href="/app/">
            {tr("Sign in", "Anmelden")}
          </a>
          <a className="button" href={link("downloads")}>
            {tr("Get Rankwisp", "Rankwisp laden")} <ArrowUpRight size={14} />
          </a>
          <button
            className="icon-button site-menu"
            onClick={() => setMenu(!menu)}
            aria-expanded={menu}
            aria-controls="marketing-navigation"
            aria-label={tr("Toggle navigation", "Navigation umschalten")}
          >
            <ChevronDown size={20} />
          </button>
        </div>
      </header>
      <main id="content">
        {page === "home" ? (
          <>
            <section className="site-hero">
              <div className="hero-editorial">
                <div className="hero-copy">
                  <div className="hero-kicker">
                    <span />{" "}
                    {tr(
                      "A LITTLE CLARITY FOR APP MAKERS",
                      "MEHR KLARHEIT FÜR APP-ENTWICKLER",
                    )}
                  </div>
                  <h1>
                    {tr("Your app has potential.", "Deine App hat Potenzial.")}
                    <br />
                    <em>{tr("Make it visible.", "Mach es sichtbar.")}</em>
                  </h1>
                  <p>
                    {tr(
                      "Know where your app stands. Track App Store keywords, compare the right apps and turn observations into your next move.",
                      "Wisse, wo deine App steht. Beobachte App-Store-Keywords, vergleiche die passenden Apps und leite aus Messungen deinen nächsten Schritt ab.",
                    )}
                  </p>
                  <DownloadChoices />
                  <div className="hero-browser-links">
                    <a href="/app/?demo=1">
                      {tr("Explore the browser demo", "Browser-Demo entdecken")}{" "}
                      <ArrowUpRight size={15} />
                    </a>
                    <span aria-hidden="true">/</span>
                    <a href="/app/">
                      {tr("Sign in", "Anmelden")} <ArrowRight size={15} />
                    </a>
                  </div>
                  <GoogleAvailability />
                </div>
                <div className="brand-presence" aria-hidden="true">
                  <div className="brand-presence-lines">
                    <i />
                    <i />
                    <i />
                  </div>
                  <img
                    src="/brand/symbol.png"
                    width="320"
                    height="320"
                    alt=""
                  />
                  <span>
                    {tr("LESS NOISE.", "WENIGER RAUSCHEN.")}
                    <br />
                    {tr("MORE PERSPECTIVE.", "MEHR ÜBERBLICK.")}
                  </span>
                </div>
              </div>
              <ProductShot />
              <div className="product-principles">
                <span>
                  <ShieldCheck size={15} />
                  {tr(
                    "Observations, not estimates",
                    "Messungen statt Schätzungen",
                  )}
                </span>
                <span>
                  <ArrowDownToLine size={15} />
                  {tr("Your history, exportable", "Dein Verlauf, exportierbar")}
                </span>
                <a
                  href="https://github.com/Yann1s2/Rankwisp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tr("Open source · MIT", "Open Source · MIT")}{" "}
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
                    03 <ArrowUpRight size={19} />
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
                <figure className="keyword-shot">
                  <img
                    src="/site/app-keywords.webp"
                    width="1440"
                    height="900"
                    loading="lazy"
                    alt={tr(
                      "The real Rankwisp keyword manager, showing editable keyword groups and archiving controls with fictional demo data.",
                      "Die echte Rankwisp-Keyword-Verwaltung mit bearbeitbaren Gruppen und Archivierung anhand fiktiver Demo-Daten.",
                    )}
                  />
                  <figcaption>
                    {tr(
                      "A considered workspace. A clear next step.",
                      "Ein durchdachter Arbeitsbereich. Ein klarer nächster Schritt.",
                    )}
                  </figcaption>
                </figure>
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
                  {tr("Explore the preview", "Vorschau entdecken")}{" "}
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
                      "Mac Apple Silicon and Windows x64 previews are available as ZIP downloads. They are unsigned; Mac notarisation and Windows runtime validation remain pending. The iOS artifact is only for the Xcode Simulator, not a physical iPhone. The browser demo works without installing anything.",
                      "Vorschauen für Mac mit Apple Silicon und Windows x64 sind als ZIP verfügbar. Sie sind unsigniert; Mac-Notarisierung und Windows-Laufzeitprüfung stehen aus. Das iOS-Artefakt ist nur für den Xcode-Simulator, nicht für ein physisches iPhone. Die Browser-Demo benötigt keine Installation.",
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
              <img
                className="closing-symbol"
                src="/brand/symbol.png"
                width="48"
                height="48"
                alt=""
              />
              <h2>
                {tr(
                  "Your next good move starts with a clearer view.",
                  "Dein nächster guter Schritt beginnt mit einem klaren Blick.",
                )}
              </h2>
              <a href={link("downloads")} className="button light large">
                {tr("Get the preview", "Vorschau herunterladen")}{" "}
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
            {tr("Working brand, preview", "Arbeitsmarke, Vorschau")}
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
          <a
            href="https://github.com/Yann1s2/Rankwisp"
            target="_blank"
            rel="noopener noreferrer"
          >
            {tr("Open source · MIT", "Open Source · MIT")}
          </a>
        </div>
      </footer>
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
      downloads: tr("Download Rankwisp.", "Rankwisp herunterladen."),
    }[page] || "Rankwisp";
  return (
    <section className="info-page site-section">
      <span className="eyebrow">
        RANKWISP / {tr("DEVELOPMENT PREVIEW", "ENTWICKLUNGSVORSCHAU")}
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
              "A clearer view, on your desktop. Download a development preview or explore the same interface in your browser.",
              "Ein klarer Blick, auf deinem Desktop. Lade eine Entwicklungsvorschau herunter oder entdecke dieselbe Oberfläche im Browser.",
            )}
          </p>
          <DownloadChoices />
          <div className="download-guidance">
            <article>
              <Apple size={22} />
              <h2>Mac · Apple Silicon</h2>
              <p>
                {tr(
                  "For M-series Macs. Not Developer-ID signed or notarised; macOS may block this preview. No Intel Mac build is included.",
                  "Für Macs mit M-Chip. Nicht mit Developer ID signiert oder notarisiert; macOS kann die Vorschau blockieren. Ein Build für Intel-Macs ist nicht enthalten.",
                )}
              </p>
            </article>
            <article>
              <Monitor size={22} />
              <h2>Windows · x64</h2>
              <p>
                {tr(
                  "Portable ZIP: extract it, then open Rankwisp.exe. Not signed or runtime-verified on Windows yet. No automatic updater is included.",
                  "Portables ZIP: Entpacken und Rankwisp.exe öffnen. Noch nicht signiert oder unter Windows laufzeitgeprüft. Ein automatischer Updater ist nicht enthalten.",
                )}
              </p>
            </article>
          </div>
          <div className="download-browser">
            <div>
              <h2>
                {tr(
                  "Prefer to take a look first?",
                  "Lieber zuerst einen Blick hineinwerfen?",
                )}
              </h2>
              <p>
                {tr(
                  "No installation or account needed for the demo. Sign in to create your own workspace.",
                  "Die Demo benötigt weder Installation noch Konto. Melde dich für deinen eigenen Arbeitsbereich an.",
                )}
              </p>
            </div>
            <a href="/app/?demo=1" className="button">
              {tr("Open the demo", "Demo öffnen")} <ArrowUpRight size={15} />
            </a>
            <a href="/app/" className="text-button">
              {tr("Sign in", "Anmelden")} <ArrowRight size={14} />
            </a>
          </div>
          <details className="developer-downloads">
            <summary>
              {tr("iOS Simulator & source code", "iOS-Simulator & Quellcode")}{" "}
              <ChevronDown size={16} />
            </summary>
            <p>
              {tr(
                "The iOS build is for the Xcode Simulator. It is not an iPhone installer, App Store release or TestFlight invitation.",
                "Der iOS-Build ist für den Xcode-Simulator. Er ist kein iPhone-Installer, App-Store-Release oder TestFlight-Zugang.",
              )}
            </p>
            <div>
              <a href={ASSETS + "Rankwisp-0.2.0-ios-simulator.zip"}>
                {tr(
                  "Download simulator build",
                  "Simulator-Build herunterladen",
                )}{" "}
                <Download size={14} />
              </a>
              <a href="https://github.com/Yann1s2/Rankwisp">
                {tr("Source code & setup", "Quellcode & Einrichtung")}{" "}
                <ArrowUpRight size={14} />
              </a>
              <a href={ASSETS + "SHA256SUMS-0.2.2.txt"}>
                {tr("Checksums", "Prüfsummen")} <ArrowUpRight size={14} />
              </a>
            </div>
          </details>
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
              "When you sign in with an enabled provider: your Google or Apple account identifier and verified email (including an Apple relay address when chosen), hashed session records, trial dates, licence and usage counters, selected apps, keywords, observations and import backups. Google access and ID tokens are not retained. For Apple sign-in, a refresh grant is stored encrypted so access can be revoked when you delete your account. Password hashes apply only to the separate local Node version. Local language preference is saved on your device. Session cookies are necessary for sign-in; no advertising cookies are used.",
              "Bei Anmeldung mit einem aktivierten Anbieter: Google- oder Apple-Kontokennung und bestätigte E-Mail (gegebenenfalls eine gewählte Apple-Relay-Adresse), gehashte Sitzungsdaten, Testbeginn, Lizenz und Nutzungskontingente, gewählte Apps, Keywords, Messungen und Importsicherungen. Google-Zugriffs- und ID-Tokens werden nicht aufbewahrt. Bei Apple-Anmeldung wird ein Refresh-Token verschlüsselt gespeichert, um den Zugang bei Kontolöschung zu widerrufen. Passwort-Hashes betreffen nur die separate lokale Node-Version. Die Sprachwahl wird lokal gespeichert. Sitzungscookies sind zur Anmeldung erforderlich; Werbecookies werden nicht eingesetzt.",
            )}
          </p>
          <h2>{tr("Where requests go", "Wohin Anfragen gehen")}</h2>
          <p>
            {tr(
              "Cloudflare serves this website and API and stores account data using D1 and SQLite Durable Objects; network requests disclose your IP address to Cloudflare. Google or Apple handles sign-in when that provider is enabled and selected. Apple receives search terms, app IDs and storefront country. App icons load from Apple’s CDN and may expose your IP address to Apple. With your separate permission, OpenAI receives bounded project observations for requested advice. Provider API keys remain on the server. Payment processing will use a configured provider only after launch approval.",
              "Cloudflare stellt Website und API bereit und speichert Kontodaten in D1 und SQLite Durable Objects; dabei erhält Cloudflare deine IP-Adresse. Google oder Apple übernimmt die Anmeldung, wenn der jeweilige Anbieter aktiviert und ausgewählt ist. Apple erhält Suchbegriffe, App-IDs und das Store-Land. App-Icons werden von Apples CDN geladen, wodurch Apple deine IP-Adresse erhält. Mit deiner gesonderten Einwilligung erhält OpenAI begrenzte Projektmessungen für angeforderte Empfehlungen. API-Schlüssel bleiben auf dem Server. Zahlungsabwicklung erfolgt erst nach Freigabe über einen eingerichteten Anbieter.",
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
