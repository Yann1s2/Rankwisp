import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Search,
  ChartNoAxesCombined,
  Users,
  Settings,
  Plus,
  ArrowRight,
  ArrowUpRight,
  ArrowDownToLine,
  RefreshCw,
  ChevronDown,
  Globe,
  LogOut,
  ShieldCheck,
  Check,
  Command,
  BookOpen,
  Archive,
  PanelLeftClose,
  Menu,
  Info,
  FileUp,
  Mail,
  Sun,
  X,
  Eye,
  ClipboardList,
  ExternalLink,
  Download,
} from "lucide-react";
import {
  api,
  exportFile,
  clearToken,
  ios,
  Store,
  native,
  beginGoogleSignIn,
  beginAppleSignIn,
  retrySecureSession,
} from "./api";
import { useLocale, errorText } from "./i18n";
import {
  Brand,
  Button,
  AppIcon,
  StoreLink,
  Status,
  Empty,
  Modal,
  Chart,
  Delta,
} from "./components";
import {
  quality,
  latest,
  visibility,
  normalizeKeywords,
} from "../shared/domain.mjs";
import { demoWorkspace } from "./demo.mjs";
import Onboarding from "./onboarding";
import Welcome from "./Welcome";
import { KeywordStandings } from "./KeywordStandings";
import "./history-fit.css";
import KeywordSuggestions, {
  appendKeywordSuggestions,
} from "./KeywordSuggestions";
const demo = new URLSearchParams(window.location.search).has("demo");
export default function App() {
  const { tr, locale, setLocale, date, number } = useLocale();
  const [me, setMe] = useState(null),
    [workspace, setWorkspace] = useState(null),
    [revision, setRevision] = useState(""),
    [config, setConfig] = useState({}),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("overview"),
    [projectID, setProjectID] = useState(null),
    [selectedKeyword, setSelectedKeyword] = useState(null),
    [days, setDays] = useState(30),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(null),
    [modal, setModal] = useState(null),
    [sidebar, setSidebar] = useState(false),
    [filter, setFilter] = useState(""),
    [archives, setArchives] = useState(false),
    [advice, setAdvice] = useState(null),
    [aiKind, setAIKind] = useState("next"),
    [decision, setDecision] = useState(false),
    [importPreview, setImportPreview] = useState(null),
    [importRaw, setImportRaw] = useState(null);
  const inputFile = useRef();
  const reconciling = useRef(new Set());
  const project =
    workspace?.projects.find((p) => String(p.id) === String(projectID)) ||
    workspace?.projects[0];
  const keywords = project?.keywords ?? [];
  const keyword =
    keywords.find((k) => String(k.id) === selectedKeyword) ||
    keywords.find((k) => !k.archived) ||
    keywords[0];
  const notify = (text, type = "success") => setNotice({ text, type });
  async function refreshAIUsage() {
    try {
      setMe(await api("/me"));
    } catch {
      /* Usage refresh can be retried on the next workspace load. */
    }
  }
  async function saveAIConsent(aiConsent) {
    await api("/preferences", { aiConsent }, "PATCH");
    setMe((previous) => ({ ...previous, aiConsent }));
  }
  async function load() {
    const [m, w] = await Promise.all([api("/me"), api("/workspace")]);
    setMe(m);
    setWorkspace(w.workspace);
    setRevision(w.revision);
  }
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const editing = /^(INPUT|TEXTAREA|SELECT)$/.test(
        document.activeElement?.tagName || "",
      );
      const keyboard = editing && viewport.height < innerHeight * 0.78;
      document.documentElement.style.setProperty(
        "--app-height",
        keyboard ? `${viewport.height}px` : "100dvh",
      );
      document.body.classList.toggle("keyboard-open", keyboard);
      if (keyboard)
        document.activeElement?.scrollIntoView({ block: "nearest" });
    };
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      document.body.classList.remove("keyboard-open");
    };
  }, []);
  useEffect(() => {
    if (!sidebar) return;
    const old = document.activeElement;
    const menu = document.querySelector(".sidebar");
    const items = () =>
      [...menu.querySelectorAll("button:not(:disabled),a[href],select")].filter(
        (el) => el.getClientRects().length,
      );
    items()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSidebar(false);
      }
      if (e.key === "Tab") {
        const list = items(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, [sidebar]);
  useEffect(() => {
    if (demo) {
      setWorkspace(demoWorkspace());
      setMe({
        account: { email: "preview", id: "demo" },
        license: {
          state: "trial",
          daysRemaining: 24,
          checksRemaining: 120,
          aiRemaining: 8,
        },
      });
      setBoot(false);
      return;
    }
    Promise.all([api("/config").then(setConfig), load()])
      .catch((e) => {
        if (e.status !== 401) notify(errorText(e.message, locale), "error");
      })
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    const handler = (e) => notify(errorText(e.detail, locale), "error");
    window.addEventListener("rankwisp:session-error", handler);
    return () => window.removeEventListener("rankwisp:session-error", handler);
  }, [locale]);
  useEffect(() => {
    if (!ios || !me?.account?.id || demo) return;
    let active = true,
      listener;
    async function reconcile(tx) {
      if (!tx?.transactionID || reconciling.current.has(tx.transactionID))
        return;
      reconciling.current.add(tx.transactionID);
      try {
        await api("/billing/apple", {
          signedTransaction: tx.signedTransaction,
        });
        await Store.finish({ transactionID: tx.transactionID });
        if (active) await load();
      } catch (e) {
        if (active) notify(errorText(e.message, locale), "error");
      } finally {
        reconciling.current.delete(tx.transactionID);
      }
    }
    Store.addListener("transactionUpdated", reconcile)
      .then((handle) => {
        if (active) listener = handle;
        else handle.remove().catch(() => {});
      })
      .catch((e) => {
        if (active) notify(errorText(e.message, locale), "error");
      });
    Store.unfinished()
      .then((result) => {
        if (active) return Promise.all(result.transactions.map(reconcile));
      })
      .catch((e) => {
        if (active) notify(errorText(e.message, locale), "error");
      });
    return () => {
      active = false;
      listener?.remove().catch(() => {});
    };
  }, [me?.account?.id]);
  useEffect(() => {
    setAdvice(null);
    setSelectedKeyword(null);
  }, [projectID]);
  useEffect(() => {
    if (busy !== "refresh" || demo) return;
    const id = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(id);
  }, [busy]);
  useEffect(() => {
    const listener = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPage("keywords");
        requestAnimationFrame(() =>
          document.querySelector("[data-keyword-search]")?.focus(),
        );
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  async function action(name, fn) {
    if (demo) {
      notify(
        tr(
          "This is an illustration. Sign in to work with real apps.",
          "Dies ist eine Illustration. Melde dich an, um echte Apps zu beobachten.",
        ),
        "info",
      );
      return;
    }
    setBusy(name);
    try {
      const result = await fn();
      if (name === "delete") return result;
      await load();
      if (["export", "refresh"].includes(name))
        api("/telemetry", {
          surface: "app",
          event: name === "export" ? "export" : "refresh_complete",
        }).catch(() => {});
      return result;
    } catch (e) {
      notify(errorText(e.message, locale), "error");
    } finally {
      setBusy("");
    }
  }
  const navigate = (value) => {
    setPage(value);
    setSidebar(false);
    if (ios) Store.haptic().catch(() => {});
  };
  async function refresh(k) {
    await action("refresh", async () => {
      const result = await api(
        `/projects/${project.id}/refresh`,
        k ? { keywordID: k.id } : {},
      );
      notify(
        tr(
          `${result.completed} measurements saved. ${result.errors} fetch errors.`,
          `${result.completed} Messungen gespeichert. ${result.errors} Abruffehler.`,
        ),
        result.errors ? "info" : "success",
      );
    });
  }
  async function exportData() {
    await action("export", async () => {
      await exportFile(await api("/export"));
      notify(
        tr(
          "Your full history has been exported.",
          "Dein vollständiger Verlauf wurde exportiert.",
        ),
      );
    });
  }
  async function readImport(file) {
    if (!file) return;
    await action("import", async () => {
      if (file.size > 48 * 1024 * 1024) throw Error("IMPORT_FILE_TOO_LARGE");
      let raw;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        throw Error("IMPORT_INVALID_JSON");
      }
      const result = await api("/import/preview", raw);
      setImportRaw(raw);
      setImportPreview(result);
      setModal("import");
    });
    if (inputFile.current) inputFile.current.value = "";
  }
  if (boot)
    return (
      <div className="boot">
        <Brand />
        <span>
          {tr("Opening your workspace…", "Dein Arbeitsbereich wird geöffnet…")}
        </span>
      </div>
    );
  if (!me)
    return (
      <Auth
        config={config}
        onReady={async (newAccount) => {
          await load();
          if (newAccount === true) setModal("onboarding");
        }}
        notice={notice}
        onRetry={async () => {
          await retrySecureSession();
          const next = await api("/config");
          setConfig(next);
          setNotice(null);
          try {
            await load();
          } catch (e) {
            if (e.status !== 401) throw e;
          }
        }}
      />
    );
  const nav = [
    ["overview", LayoutDashboard, tr("Overview", "Übersicht")],
    ["keywords", Search, "Keywords"],
    ["history", ChartNoAxesCombined, tr("Rank history", "Ranking-Verlauf")],
    ["competitors", Users, tr("Competitors", "Konkurrenz")],
    ["insights", ArrowUpRight, tr("Next moves", "Nächste Schritte")],
  ];
  const active = keywords.filter((k) => !k.archived);
  const fresh = active.filter((k) => quality(k) === "fresh");
  const measured = active.filter((k) => latest(k));
  const top10 = active.filter(
    (k) => quality(k) === "fresh" && latest(k)?.rank <= 10,
  );
  const changes = measured
    .map((k) => ({
      k,
      last: latest(k),
      previous: k.samples
        .slice()
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
        .at(-2),
    }))
    .filter((x) => x.previous);
  const improved = changes.filter(
    (x) =>
      x.last.rank != null &&
      x.previous.rank != null &&
      x.last.rank < x.previous.rank,
  ).length;
  const title =
    nav.find((x) => x[0] === page)?.[2] || tr("Settings", "Einstellungen");
  return (
    <div className={"app-shell page-" + page}>
      <a className="skip" href="#main">
        {tr("Skip to content", "Zum Inhalt")}
      </a>
      <aside className={"sidebar " + (sidebar ? "open" : "")}>
        <a className="brand-link" href={native ? "/app" : "/" + locale}>
          <Brand />
        </a>
        <div className="workspace-label">
          {tr("WORKSPACE", "ARBEITSBEREICH")} <span>01</span>
        </div>
        <button className="project-switch" onClick={() => setModal("projects")}>
          <AppIcon app={project?.metadata} size={35} />
          <span>
            <strong>
              {project?.name || tr("Your workspace", "Dein Arbeitsbereich")}
            </strong>
            <small>
              {project?.country?.toUpperCase() ||
                tr("Add your first app", "Erste App hinzufügen")}
            </small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="sidebar-nav">
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "insights" && <span className="new-dot" />}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="trial-card">
            <span className="trial-icon">
              <Sun size={17} />
            </span>
            <strong>
              {me.license.state === "paid"
                ? tr("Yours to keep", "Deine Lizenz")
                : me.license.state === "expired"
                  ? tr("Your data stays yours", "Deine Daten bleiben dir")
                  : tr("A little room to explore", "Zeit zum Entdecken")}
            </strong>
            <p>
              {me.license.state === "paid"
                ? tr("One purchase. No subscription.", "Ein Kauf. Kein Abo.")
                : me.license.state === "expired"
                  ? tr(
                      "Read and export any time.",
                      "Jederzeit lesen und exportieren.",
                    )
                  : tr(
                      `${me.license.daysRemaining} days left in your trial`,
                      `${me.license.daysRemaining} Tage deiner Testphase übrig`,
                    )}
            </p>
            <button
              onClick={() => {
                setPage("settings");
                setSidebar(false);
              }}
            >
              {tr("Plan & usage", "Lizenz & Nutzung")}{" "}
              <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={
              "sidebar-setting " + (page === "settings" ? "active" : "")
            }
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            {tr("Settings", "Einstellungen")}
          </button>
          <a className="sidebar-setting" href="mailto:info@zhstudio.ch">
            <BookOpen size={18} />
            {tr("Help & feedback", "Hilfe & Feedback")}
          </a>
          <div className="account-chip">
            <span>{demo ? "D" : me.account.email[0].toUpperCase()}</span>
            <div>
              <strong>
                {demo
                  ? tr("Explore Rankwisp", "Rankwisp entdecken")
                  : me.account.email}
              </strong>
              <small>
                {demo
                  ? tr("Illustrative workspace", "Beispiel-Arbeitsbereich")
                  : tr("Personal workspace", "Persönlicher Arbeitsbereich")}
              </small>
            </div>
            <button
              className="icon-button"
              title={tr("Sign out", "Abmelden")}
              onClick={async () => {
                if (demo) {
                  window.location.href = "/app";
                  return;
                }
                try {
                  await api("/auth/logout", {});
                  clearToken();
                  setMe(null);
                  setWorkspace(null);
                } catch (e) {
                  notify(errorText(e.message, locale), "error");
                }
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label={tr("Close navigation", "Navigation schliessen")}
          onClick={() => setSidebar(false)}
        />
      )}
      <div className="app-content" inert={sidebar || undefined}>
        <header className="app-header">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label={tr("Open navigation", "Navigation öffnen")}
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span className="muted">{tr("Workspace", "Arbeitsbereich")}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="header-actions">
            <span className="preview-pill">
              {demo
                ? tr("Demo · fictional data", "Demo · fiktive Daten")
                : tr("Private preview", "Private Vorschau")}
            </span>
            <button
              className="locale-button"
              onClick={() => setLocale(locale === "en" ? "de" : "en")}
            >
              <Globe size={14} />
              {locale.toUpperCase()}
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            {tr(
              "A look around, with clearly fictional example data.",
              "Ein Rundgang mit ausdrücklich fiktiven Beispieldaten.",
            )}{" "}
            <a href="/app/">
              {tr("Track your own app", "Eigene App beobachten")}{" "}
              <ArrowRight size={13} />
            </a>
          </div>
        )}
        <main id="main" className="workspace-main" key={page}>
          {me.license.state === "pending" && (
            <div className="notice">
              {tr(
                "Activate your free 24-day trial in Settings. No automatic payment follows.",
                "Aktiviere deine kostenlose 24-Tage-Testphase in den Einstellungen. Es folgt keine automatische Zahlung.",
              )}{" "}
              <button
                className="text-button"
                onClick={() => setPage("settings")}
              >
                {tr("Open settings", "Einstellungen öffnen")}
              </button>
            </div>
          )}
          {notice && (
            <div className={"notice toast " + notice.type} role="status">
              <span>{notice.text}</span>
              <button
                className="icon-button"
                aria-label={tr("Dismiss", "Schliessen")}
                onClick={() => setNotice(null)}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!project ? (
            page === "settings" ? null : (
              <Empty
                title={tr(
                  "Meet your next chapter.",
                  "Dein nächstes Kapitel wartet.",
                )}
              >
                {tr(
                  "Find your app, choose meaningful comparisons, and make your next move with confidence.",
                  "Finde deine App, wähle passende Vergleiche und entscheide deinen nächsten Schritt.",
                )}
                <div className="empty-actions">
                  <Button onClick={() => setModal("onboarding")}>
                    {tr("Find my app", "Meine App finden")}{" "}
                    <ArrowRight size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => inputFile.current.click()}
                  >
                    <FileUp size={16} />
                    {tr("Import Rankblick data", "Rankblick-Daten importieren")}
                  </Button>
                </div>
              </Empty>
            )
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {project.name} <span>·</span>{" "}
                    {new Intl.DisplayNames([locale], { type: "region" }).of(
                      project.country.toUpperCase(),
                    )}
                  </div>
                  <h1>
                    {page === "overview"
                      ? tr("Your app, at a glance.", "Deine App im Überblick.")
                      : title}
                  </h1>
                  <p>
                    {page === "overview"
                      ? tr(
                          "Real observations. A little perspective.",
                          "Echte Messungen. Ein klarer Blick.",
                        )
                      : page === "history"
                        ? tr(
                            "Every observation, with the context it deserves.",
                            "Jede Messung – mit dem Kontext, den sie braucht.",
                          )
                        : page === "keywords"
                          ? tr(
                              "The searches that connect people to your app.",
                              "Die Suchbegriffe, die Menschen zu deiner App führen.",
                            )
                          : page === "competitors"
                            ? tr(
                                "A useful comparison starts with a considered selection.",
                                "Ein nützlicher Vergleich beginnt mit einer bewussten Auswahl.",
                              )
                            : page === "insights"
                              ? tr(
                                  "A short list of useful next steps, grounded in your data.",
                                  "Wenige nützliche Schritte, begründet durch deine Daten.",
                                )
                              : tr(
                                  "Your workspace, your choices.",
                                  "Dein Arbeitsbereich, deine Entscheidungen.",
                                )}
                  </p>
                </div>
                {["overview", "keywords", "history"].includes(page) && (
                  <div className="heading-actions">
                    <Button
                      variant="secondary"
                      loading={busy === "export"}
                      onClick={exportData}
                    >
                      <ArrowDownToLine size={16} />
                      {tr("Export", "Exportieren")}
                    </Button>
                    <Button
                      loading={busy === "refresh"}
                      onClick={() => refresh()}
                    >
                      <RefreshCw size={15} />
                      {tr("Refresh", "Aktualisieren")}
                    </Button>
                  </div>
                )}
              </div>
              {page === "overview" && (
                <>
                  <div className="metric-grid">
                    <Metric
                      label={tr("Keywords tracked", "Beobachtete Keywords")}
                      value={number(active.length)}
                      detail={tr(
                        "A focused view of your app",
                        "Ein fokussierter Blick auf deine App",
                      )}
                      icon={Search}
                    />
                    <Metric
                      label={tr("Top 10 positions", "Top-10-Positionen")}
                      value={demo ? "3" : number(top10.length)}
                      detail={tr(
                        "From fresh observations only",
                        "Nur aus aktuellen Messungen",
                      )}
                      icon={ChartNoAxesCombined}
                    />
                    <Metric
                      label={tr("Moving up", "Aufwärtsbewegungen")}
                      value={number(improved)}
                      detail={tr(
                        "Since the previous observation",
                        "Seit der vorherigen Messung",
                      )}
                      icon={ArrowUpRight}
                    />
                    <Metric
                      label={tr("Data coverage", "Datenabdeckung")}
                      value={
                        demo
                          ? "100%"
                          : active.length
                            ? number(fresh.length / active.length, {
                                style: "percent",
                                maximumFractionDigits: 0,
                              })
                            : "—"
                      }
                      detail={tr(
                        "Fresh, found, no current error",
                        "Aktuell, gefunden, ohne Abruffehler",
                      )}
                      icon={ShieldCheck}
                    />
                  </div>
                  <div className="dashboard-columns dashboard-primary">
                    <section className="panel chart-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            {tr(
                              "Your visibility, over time",
                              "Deine Sichtbarkeit im Verlauf",
                            )}
                          </h2>
                          <p>
                            {tr(
                              "Observed search position",
                              "Gemessene Suchposition",
                            )}{" "}
                            · {keyword?.text || "—"}
                          </p>
                        </div>
                        <Period days={days} setDays={setDays} />
                      </div>
                      <Chart
                        keyword={keyword}
                        days={days}
                        illustration={demo}
                      />
                      <div className="chart-footer">
                        <label>
                          <span className="sr-only">Keyword</span>
                          <select
                            value={keyword?.id || ""}
                            onChange={(e) => setSelectedKeyword(e.target.value)}
                          >
                            {keywords.map((k) => (
                              <option key={k.id} value={k.id}>
                                {k.text}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="text-button"
                          onClick={() => setPage("history")}
                        >
                          {tr("Explore history", "Verlauf ansehen")}{" "}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </section>
                    <aside className="next-card">
                      <div className="next-copy">
                        <span className="next-tag">
                          {tr("NEXT MOVE", "NÄCHSTER SCHRITT")}
                        </span>
                        <h2>
                          {active.length
                            ? tr(
                                "A clearer next step.",
                                "Ein klarer nächster Schritt.",
                              )
                            : tr(
                                "Start with what your app does best.",
                                "Beginne mit der Stärke deiner App.",
                              )}
                        </h2>
                        <p>
                          {active.length
                            ? tr(
                                "Find a useful idea in your latest observations.",
                                "Finde eine nützliche Idee in deinen letzten Messungen.",
                              )
                            : tr(
                                "Choose a few phrases a future user might type. Measure first, then decide.",
                                "Wähle einige Begriffe, nach denen künftige Nutzer suchen könnten. Erst messen, dann entscheiden.",
                              )}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setPage("insights")}
                      >
                        {tr("Review next moves", "Nächste Schritte")}{" "}
                        <ArrowRight size={15} />
                      </Button>
                      <small>
                        {tr(
                          "Grounded in observations. Always your decision.",
                          "Auf Messungen gestützt. Immer deine Entscheidung.",
                        )}
                      </small>
                    </aside>
                  </div>
                  <div className="dashboard-columns dashboard-secondary">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            {tr(
                              "Keywords to keep an eye on",
                              "Keywords im Blick",
                            )}
                          </h2>
                          <p>
                            {tr(
                              "Your latest observations, at a glance.",
                              "Deine letzten Messungen auf einen Blick.",
                            )}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => setPage("keywords")}
                        >
                          {tr("View all", "Alle ansehen")}{" "}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <KeywordTable
                        keywords={active.slice(0, 3)}
                        demo={demo}
                        onSelect={(k) => {
                          setSelectedKeyword(k.id);
                          setPage("history");
                        }}
                      />
                    </section>
                    <section className="panel quiet-panel">
                      <div className="panel-heading">
                        <h2>{tr("The full picture", "Das Gesamtbild")}</h2>
                        <ShieldCheck size={18} />
                      </div>
                      <p>
                        {tr(
                          "Honest data makes better decisions.",
                          "Ehrliche Daten führen zu besseren Entscheidungen.",
                        )}
                      </p>
                      <div className="quality-row">
                        <span>{tr("Storefront", "Store-Land")}</span>
                        <strong>{project.country.toUpperCase()}</strong>
                      </div>
                      <div className="quality-row">
                        <span>{tr("Source", "Quelle")}</span>
                        <strong>Apple Search API</strong>
                      </div>
                      <div className="quality-row">
                        <span>{tr("Fetch errors", "Abruffehler")}</span>
                        <strong>
                          {active.filter((k) => k.lastError).length}
                        </strong>
                      </div>
                      <div className="quality-row">
                        <span>{tr("Unmeasured", "Ungemessen")}</span>
                        <strong>
                          {active.filter((k) => !latest(k)).length}
                        </strong>
                      </div>
                      <p className="small muted">
                        {tr(
                          "API result order can differ from iPhone search. No estimated downloads or search volume.",
                          "Die API-Reihenfolge kann von der iPhone-Suche abweichen. Keine geschätzten Downloads oder Suchvolumen.",
                        )}
                      </p>
                    </section>
                  </div>
                </>
              )}
              {page === "keywords" && (
                <section className="panel keyword-management-panel">
                  <div className="table-toolbar">
                    <label className="input-icon">
                      <Search size={16} />
                      <input
                        data-keyword-search
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder={tr(
                          "Filter keywords…",
                          "Keywords filtern…",
                        )}
                      />
                      <kbd>⌘ K</kbd>
                    </label>
                    <label className="toggle-inline">
                      <input
                        type="checkbox"
                        checked={archives}
                        onChange={(e) => setArchives(e.target.checked)}
                      />
                      {tr("Archived", "Archiviert")}
                    </label>
                    <Button
                      variant="secondary"
                      onClick={() => setModal("keyword-suggestions")}
                    >
                      {tr("Suggest keywords", "Keywords vorschlagen")}
                    </Button>
                    <Button onClick={() => setModal("keyword")}>
                      <Plus size={16} />
                      {tr("Add keywords", "Keywords hinzufügen")}
                    </Button>
                  </div>
                  <KeywordTable
                    keywords={keywords.filter(
                      (k) =>
                        k.archived === archives &&
                        k.text.toLowerCase().includes(filter.toLowerCase()),
                    )}
                    demo={demo}
                    onSelect={(k) => {
                      setSelectedKeyword(k.id);
                      setPage("history");
                    }}
                    management
                    onArchive={(k) =>
                      action("archive", () =>
                        api(
                          `/projects/${project.id}/keywords/${k.id}`,
                          { archived: !k.archived },
                          "PATCH",
                        ),
                      )
                    }
                    onCategory={(k, category) =>
                      action("category", () =>
                        api(
                          `/projects/${project.id}/keywords/${k.id}`,
                          { category },
                          "PATCH",
                        ),
                      )
                    }
                  />
                  <div className="panel-note">
                    <Info size={14} />
                    {tr(
                      "Archiving stops tracking and keeps every past observation.",
                      "Archivieren beendet die Beobachtung und erhält alle bisherigen Messungen.",
                    )}
                  </div>
                </section>
              )}
              {page === "history" && (
                <>
                  <section className="panel history-chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          {keyword?.text ||
                            tr(
                              "No keyword selected",
                              "Kein Keyword ausgewählt",
                            )}
                        </h2>
                        <p>
                          {tr(
                            "Actual position in the returned search results",
                            "Tatsächliche Position in der gelieferten Trefferliste",
                          )}
                        </p>
                      </div>
                      <div className="history-controls">
                        <select
                          aria-label="Keyword"
                          value={keyword?.id || ""}
                          onChange={(e) => setSelectedKeyword(e.target.value)}
                        >
                          {keywords.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.text}
                              {k.archived
                                ? " · " + tr("Archived", "Archiviert")
                                : ""}
                            </option>
                          ))}
                        </select>
                        <Period days={days} setDays={setDays} />
                      </div>
                    </div>
                    <Chart
                      keyword={keyword}
                      comparison={(project.competitors ?? []).slice(0, 2)}
                      days={days}
                      illustration={demo}
                    />
                  </section>
                  <section className="panel history-log-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>{tr("Measurement log", "Messprotokoll")}</h2>
                        <p>
                          {tr(
                            "Missing results and fetch failures never become invented ranks.",
                            "Fehlende Treffer und Abruffehler werden nie zu erfundenen Rängen.",
                          )}
                        </p>
                      </div>
                      {keyword && (
                        <Button
                          variant="secondary"
                          loading={busy === "refresh"}
                          onClick={() => refresh(keyword)}
                        >
                          <RefreshCw size={14} />
                          {tr("Measure this keyword", "Dieses Keyword messen")}
                        </Button>
                      )}
                    </div>
                    {keyword?.lastError && (
                      <div className="notice error">
                        {errorText(keyword.lastError, locale)}{" "}
                        {keyword.lastAttempt &&
                          date(keyword.lastAttempt, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                      </div>
                    )}
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{tr("Retrieved", "Abgerufen")}</th>
                            <th>{tr("Position", "Position")}</th>
                            <th>{tr("Results", "Treffer")}</th>
                            <th>{tr("Source", "Quelle")}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {(keyword?.samples ?? [])
                            .slice()
                            .sort(
                              (a, b) => Date.parse(b.date) - Date.parse(a.date),
                            )
                            .map((s) => (
                              <tr key={s.id}>
                                <td>
                                  {date(s.date, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })}
                                </td>
                                <td>
                                  <strong>
                                    {s.rank == null
                                      ? tr("Not found", "Nicht gefunden")
                                      : "#" + s.rank}
                                  </strong>
                                </td>
                                <td>{number(s.resultCount)}</td>
                                <td className="muted">{s.source}</td>
                                <td>
                                  <button
                                    className="text-button"
                                    onClick={() => setModal({ sample: s })}
                                  >
                                    {tr("Inspect", "Ansehen")}{" "}
                                    <ArrowUpRight size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {!keyword?.samples.length && (
                      <Empty
                        title={tr(
                          "No observations yet.",
                          "Noch keine Messungen.",
                        )}
                      >
                        {tr(
                          "Refresh this keyword to begin its history.",
                          "Aktualisiere dieses Keyword für den ersten Messpunkt.",
                        )}
                      </Empty>
                    )}
                  </section>
                </>
              )}
              {page === "competitors" && (
                <Competitors
                  project={project}
                  keyword={keyword}
                  keywords={keywords}
                  onSelectKeyword={(id) => setSelectedKeyword(String(id))}
                  demo={demo}
                  action={action}
                  setModal={setModal}
                />
              )}
              {page === "insights" && (
                <div className="insights-layout">
                  <section className="panel advice-panel">
                    <span className="eyebrow">
                      <ArrowUpRight size={15} />
                      {tr(
                        "LESS NOISE. MORE DIRECTION.",
                        "WENIGER RAUSCHEN. MEHR RICHTUNG.",
                      )}
                    </span>
                    <h2>
                      {tr(
                        "One thoughtful move beats ten guesses.",
                        "Ein durchdachter Schritt statt zehn Vermutungen.",
                      )}
                    </h2>
                    <p>
                      {tr(
                        "Choose a question. Rankwisp uses your observed ranks and selected competitors to suggest a short, reviewable next step.",
                        "Wähle eine Frage. Rankwisp nutzt deine gemessenen Ränge und gewählten Konkurrenten für kurze, überprüfbare Vorschläge.",
                      )}
                    </p>
                    <div className="insight-options">
                      {[
                        [
                          "next",
                          tr(
                            "What should I do next?",
                            "Was sollte ich als Nächstes tun?",
                          ),
                        ],
                        [
                          "weekly",
                          tr("Summarise my week", "Meine Woche zusammenfassen"),
                        ],
                        [
                          "competitors",
                          tr(
                            "Review my comparisons",
                            "Meine Vergleiche prüfen",
                          ),
                        ],
                        [
                          "creative",
                          tr(
                            "Explore icon & UI ideas",
                            "Icon- und UI-Ideen finden",
                          ),
                        ],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          className={aiKind === id ? "selected" : ""}
                          onClick={() => setAIKind(id)}
                        >
                          {label}
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                    </div>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={!!me.aiConsent}
                        onChange={(e) =>
                          action("consent", () =>
                            api(
                              "/preferences",
                              { aiConsent: e.target.checked },
                              "PATCH",
                            ),
                          )
                        }
                      />
                      <span>
                        {tr(
                          "Allow this project’s app names, keywords and recent ranks to be sent to OpenAI for advice. Never account credentials or payment data.",
                          "App-Namen, Keywords und letzte Ränge dieses Projekts für Empfehlungen an OpenAI senden. Niemals Zugangsdaten oder Zahlungsdaten.",
                        )}
                      </span>
                    </label>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={decision}
                        onChange={(e) => setDecision(e.target.checked)}
                      />
                      <span>
                        {tr(
                          "Use the stronger decision model (6× budget reservation).",
                          "Stärkeres Entscheidungsmodell nutzen (6-fache Budgetreservierung).",
                        )}
                      </span>
                    </label>
                    <Button
                      loading={busy === "advice"}
                      onClick={() =>
                        action("advice", async () =>
                          setAdvice(
                            await api(`/projects/${project.id}/advice`, {
                              locale,
                              kind: aiKind,
                              decision,
                            }),
                          ),
                        )
                      }
                    >
                      <ArrowUpRight size={16} />
                      {tr(
                        "Find a useful next step",
                        "Einen nützlichen Schritt finden",
                      )}
                    </Button>
                    {advice && (
                      <div className="advice-result" aria-live="polite">
                        <span className="eyebrow">
                          {advice.mode === "ai"
                            ? `${advice.model} · ${advice.cached ? tr("Cached", "Zwischengespeichert") : tr("Generated", "Erstellt")}`
                            : tr(
                                "Rule-based guidance · no AI request",
                                "Regelbasierte Hilfe · keine KI-Anfrage",
                              )}
                        </span>
                        {advice.mode === "ai" ? (
                          <p className="preserve-lines">{advice.text}</p>
                        ) : (
                          <>
                            <p>
                              {advice.reason === "CONSENT_REQUIRED"
                                ? tr(
                                    "AI is off until you choose to share this data.",
                                    "KI bleibt aus, bis du diese Daten freigibst.",
                                  )
                                : advice.reason === "AI_BUDGET"
                                  ? tr(
                                      "The AI allowance has been reached. These next steps remain available.",
                                      "Das KI-Kontingent ist erreicht. Diese nächsten Schritte bleiben verfügbar.",
                                    )
                                  : tr(
                                      "AI is not currently available. Here is a useful step from your data.",
                                      "KI ist gerade nicht verfügbar. Hier ist ein nützlicher Schritt aus deinen Daten.",
                                    )}
                            </p>
                            <ul>
                              {advice.items.map((x) => (
                                <li key={x}>
                                  {
                                    {
                                      refresh: tr(
                                        "Refresh stale or failed keywords before comparing.",
                                        "Aktualisiere veraltete oder fehlgeschlagene Keywords vor dem Vergleich.",
                                      ),
                                      keywords: tr(
                                        "Add three phrases describing your core function.",
                                        "Füge drei Begriffe für deine Kernfunktion hinzu.",
                                      ),
                                      compare: tr(
                                        "Open the latest results for one relevant keyword and review the leading apps.",
                                        "Öffne die letzten Treffer für ein relevantes Keyword und prüfe die führenden Apps.",
                                      ),
                                      review: tr(
                                        "Classify shared-function keywords as Core before comparing visibility shares.",
                                        "Ordne gemeinsame Funktionsbegriffe als Kernbegriffe ein, bevor du Sichtbarkeitsanteile vergleichst.",
                                      ),
                                    }[x]
                                  }
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </section>
                  <aside className="panel quiet-panel">
                    <ShieldCheck size={24} />
                    <h3>
                      {tr(
                        "Evidence before confidence.",
                        "Erst Belege, dann Vertrauen.",
                      )}
                    </h3>
                    <p>
                      {tr(
                        "Recommendations are hypotheses to review. Correlation does not establish what caused a rank change.",
                        "Empfehlungen sind Hypothesen zur Prüfung. Ein Zusammenhang beweist nicht die Ursache einer Rangänderung.",
                      )}
                    </p>
                    <div className="quality-row">
                      <span>
                        {tr(
                          "Included AI notes left",
                          "Enthaltene KI-Hinweise übrig",
                        )}
                      </span>
                      <strong>{me.license.aiRemaining}</strong>
                    </div>
                    <p className="small">
                      {tr(
                        "No automatic model upgrades. No background AI spending. Weekly summaries are generated only when you ask.",
                        "Keine automatischen Modell-Upgrades. Keine KI-Kosten im Hintergrund. Wochenberichte entstehen nur auf deinen Wunsch.",
                      )}
                    </p>
                  </aside>
                </div>
              )}
            </>
          )}
          {page === "settings" && (
            <SettingsPage
              me={me}
              workspace={workspace}
              config={config}
              action={action}
              notify={notify}
              exportData={exportData}
              importClick={() => inputFile.current.click()}
              onReauthenticated={load}
              onDeleted={() => {
                setMe(null);
                setWorkspace(null);
              }}
            />
          )}
          <footer className="workspace-footer">
            <span>
              Rankwisp <span>·</span>{" "}
              {tr(
                "Clarity, one observation at a time.",
                "Klarheit, eine Messung nach der anderen.",
              )}
            </span>
            <a href={`/${locale}/privacy`}>{tr("Privacy", "Datenschutz")}</a>
          </footer>
        </main>
      </div>
      <nav
        className="mobile-tabbar"
        inert={sidebar || undefined}
        aria-label={tr("Workspace navigation", "Arbeitsbereich-Navigation")}
      >
        {nav.map(([id, Icon, label]) => (
          <button
            key={id}
            aria-current={page === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={20} />
            <span>
              {id === "history"
                ? tr("History", "Verlauf")
                : id === "insights"
                  ? tr("Ideas", "Ideen")
                  : id === "competitors"
                    ? tr("Compare", "Vergleich")
                    : label}
            </span>
          </button>
        ))}
      </nav>
      <input
        ref={inputFile}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => readImport(e.target.files[0])}
      />
      {modal === "onboarding" && (
        <Modal
          title={tr("A new perspective", "Eine neue Perspektive")}
          onClose={() => setModal(null)}
        >
          <Onboarding
            config={config}
            aiConsent={!!me.aiConsent}
            onConsent={saveAIConsent}
            onUsageChange={refreshAIUsage}
            onCancel={() => setModal(null)}
            onComplete={async (p, automaticUpdates) => {
              await load();
              setProjectID(p.id);
              setModal(null);
              setPage("overview");
              notify(
                tr(
                  "Your app is ready. Taking your first measurements…",
                  "Deine App ist bereit. Die ersten Messungen laufen…",
                ),
                "info",
              );
              await action("refresh", async () => {
                if (automaticUpdates) await api("/preferences", { automaticUpdates: true }, "PATCH");
                const result = await api(`/projects/${p.id}/refresh`, {});
                notify(tr(
                  `${result.completed} measurements saved. ${result.errors} fetch errors.`,
                  `${result.completed} Messungen gespeichert. ${result.errors} Abruffehler.`,
                ), result.errors ? "info" : "success");
              });
            }}
          />
        </Modal>
      )}
      {modal === "projects" && (
        <Modal
          title={tr("Your apps", "Deine Apps")}
          onClose={() => setModal(null)}
        >
          <div className="app-results">
            {workspace.projects.map((p) => (
              <button
                key={p.id}
                className="app-result project-option"
                onClick={() => {
                  setProjectID(p.id);
                  setModal(null);
                }}
              >
                <AppIcon app={p.metadata} />
                <span className="project-copy">
                  <strong>{p.name}</strong>
                  <small>{p.country.toUpperCase()}</small>
                </span>
                {p.id === project?.id && <Check size={16} />}
              </button>
            ))}
          </div>
          <Button
            onClick={() =>
              demo
                ? notify(
                    tr(
                      "Sign in to add a real app.",
                      "Melde dich an, um eine echte App hinzuzufügen.",
                    ),
                    "info",
                  )
                : setModal("onboarding")
            }
          >
            <Plus size={16} />
            {tr("Add an app", "App hinzufügen")}
          </Button>
        </Modal>
      )}
      {(modal === "keyword" || modal === "keyword-suggestions") && (
        <KeywordModal
          project={project}
          config={config}
          aiConsent={!!me.aiConsent}
          onConsent={saveAIConsent}
          onUsageChange={refreshAIUsage}
          suggestionsOpen={modal === "keyword-suggestions"}
          onClose={() => setModal(null)}
          onSave={(text) =>
            action("keyword", async () => {
              await api(`/projects/${project.id}/keywords`, { text });
              setModal(null);
            })
          }
        />
      )}
      {modal === "import" && (
        <Modal
          title={tr("Review your import", "Import prüfen")}
          onClose={() => setModal(null)}
        >
          <p>
            {tr(
              "This replaces this account’s workspace. The original upload and current workspace are backed up on the server. Automatic tracking starts paused. Your Rankblick file is never changed.",
              "Dies ersetzt den Arbeitsbereich dieses Kontos. Originaldatei und aktueller Stand werden auf dem Server gesichert. Automatische Abrufe bleiben pausiert. Deine Rankblick-Datei wird nicht verändert.",
            )}
          </p>
          <div className="import-stats">
            <strong>{importPreview.projects} Apps</strong>
            <strong>{importPreview.keywords} Keywords</strong>
            <strong>
              {number(importPreview.samples)} {tr("observations", "Messungen")}
            </strong>
          </div>
          <p className="small muted">
            {tr(
              "All histories, missing results, errors and archived keywords are retained.",
              "Alle Verläufe, fehlenden Treffer, Fehler und archivierten Keywords bleiben erhalten.",
            )}
          </p>
          <Button
            loading={busy === "import-confirm"}
            onClick={() =>
              action("import-confirm", async () => {
                await api("/import", { data: importRaw, revision });
                setModal(null);
                notify(
                  tr(
                    "Import complete. The source file is unchanged.",
                    "Import abgeschlossen. Die Quelldatei ist unverändert.",
                  ),
                );
              })
            }
          >
            {tr(
              "Import & keep recovery copy",
              "Importieren & Sicherung behalten",
            )}
          </Button>
        </Modal>
      )}
      {modal?.sample && (
        <Modal
          title={tr("Observed search results", "Gemessene Suchergebnisse")}
          onClose={() => setModal(null)}
        >
          <p>
            {date(modal.sample.date, { dateStyle: "full", timeStyle: "short" })}{" "}
            · {modal.sample.resultCount} {tr("results", "Treffer")}
          </p>
          <p className="small muted">
            HTTP Date: {modal.sample.httpDate || "—"} · Cache Age:{" "}
            {modal.sample.cacheAge || "—"}
          </p>
          <ol className="results-log">
            {modal.sample.results.map((app, i) => (
              <li key={i}>
                <strong>{app.name}</strong>
                <StoreLink app={app} country={project.country} />
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  );
}
function Metric({ label, value, detail, icon: Icon }) {
  return (
    <section className="metric">
      <div>
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
function Period({ days, setDays }) {
  const { tr } = useLocale();
  return (
    <div
      className="segmented"
      aria-label={tr("Chart period", "Diagrammzeitraum")}
    >
      {[7, 30, 90, 0].map((n) => (
        <button
          key={n}
          aria-pressed={days === n}
          className={days === n ? "selected" : ""}
          onClick={() => setDays(n)}
        >
          {n ? n + tr("D", "T") : tr("All", "Alle")}
        </button>
      ))}
    </div>
  );
}
function KeywordTable({
  keywords,
  demo,
  onSelect,
  management,
  onArchive,
  onCategory,
}) {
  const { tr, date } = useLocale();
  return (
    <>
      {keywords.length ? (
        <div className="table-scroll">
          <table
            className={"keyword-table " + (management ? "managed" : "")}
            role="table"
          >
            <thead>
              <tr>
                <th>Keyword</th>
                <th>{tr("Position", "Position")}</th>
                <th>{tr("Change", "Änderung")}</th>
                <th>
                  {management
                    ? tr("Group", "Gruppe")
                    : tr("Quality", "Qualität")}
                </th>
                <th>
                  {management
                    ? tr("Actions", "Aktionen")
                    : tr("Last checked", "Letzter Abruf")}
                </th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((k) => {
                const s = latest(k),
                  p = k.samples
                    .slice()
                    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
                    .at(-2);
                return (
                  <tr key={k.id}>
                    <td>
                      <button
                        className="keyword-link"
                        onClick={() => onSelect(k)}
                      >
                        <span className="keyword-symbol">#</span>
                        {k.text}
                      </button>
                    </td>
                    <td data-label={tr("Position", "Position")}>
                      <strong>
                        {!s
                          ? "—"
                          : s.rank == null
                            ? tr("Not found", "Nicht gefunden")
                            : s.rank}
                      </strong>
                    </td>
                    <td data-label={tr("Change", "Änderung")}>
                      <Delta current={s?.rank} previous={p?.rank} />
                    </td>
                    <td>
                      {management ? (
                        <select
                          aria-label={tr("Group for ", "Gruppe für ") + k.text}
                          value={k.category ?? "unclassified"}
                          onChange={(e) => onCategory(k, e.target.value)}
                        >
                          {[
                            [
                              "unclassified",
                              tr("Unclassified", "Unklassifiziert"),
                            ],
                            ["core", tr("Core function", "Kernfunktion")],
                            ["brand", tr("Brand", "Marke")],
                            ["adjacent", tr("Adjacent", "Angrenzend")],
                          ].map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Status value={demo ? "fresh" : quality(k)} />
                      )}
                    </td>
                    <td>
                      {management ? (
                        <button
                          className="icon-button"
                          title={
                            k.archived
                              ? tr("Restore", "Wiederherstellen")
                              : tr("Archive", "Archivieren")
                          }
                          onClick={() => onArchive(k)}
                        >
                          <Archive size={16} />
                        </button>
                      ) : (
                        <span className="muted">{s ? date(s.date) : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={tr("Nothing here yet.", "Hier ist noch nichts.")}>
          {tr(
            "Add keywords or change your filter.",
            "Füge Keywords hinzu oder ändere deinen Filter.",
          )}
        </Empty>
      )}
    </>
  );
}
function KeywordModal({
  onClose,
  onSave,
  project,
  config,
  aiConsent,
  onConsent,
  onUsageChange,
  suggestionsOpen,
}) {
  const { tr } = useLocale();
  const [text, setText] = useState("");
  return (
    <Modal title={tr("Add keywords", "Keywords hinzufügen")} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(text);
        }}
      >
        <label className="field">
          {tr(
            "What might someone search for?",
            "Wonach könnten Menschen suchen?",
          )}
          <textarea
            autoFocus={!suggestionsOpen}
            required
            rows="4"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tr(
              "daily planner, habit tracker",
              "Tagesplaner, Gewohnheiten",
            )}
          />
          <span>
            {tr(
              "Separate keywords with commas or new lines.",
              "Keywords mit Kommas oder Zeilenumbrüchen trennen.",
            )}
          </span>
        </label>
        <KeywordSuggestions
          appleID={project.appleID}
          country={project.country}
          existingKeywords={[
            ...project.keywords.map((keyword) => keyword.text),
            ...normalizeKeywords(text),
          ]}
          available={!!config.aiConfigured}
          consent={aiConsent}
          onConsent={onConsent}
          onUsageChange={onUsageChange}
          demo={demo}
          initiallyOpen={suggestionsOpen}
          onApply={(words) =>
            setText((previous) => appendKeywordSuggestions(previous, words))
          }
        />
        <Button type="submit">
          <Plus size={16} />
          {tr("Add keywords", "Keywords hinzufügen")}
        </Button>
      </form>
    </Modal>
  );
}
function Auth({ onReady, config, notice, onRetry }) {
  const { tr, locale, setLocale } = useLocale();
  const [introOpen, setIntroOpen] = useState(() => {
    try { return native && localStorage.getItem("rankwisp-introduction-v1") !== "seen"; }
    catch { return native; }
  });
  const authController = useRef(null);
  useEffect(() => () => authController.current?.abort(), []);
  const [activeProvider, setActiveProvider] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false),
    [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [invite, setInvite] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(() => {
      const code = new URLSearchParams(location.search).get("authError");
      return [
        "GOOGLE_NOT_CONFIGURED",
        "GOOGLE_CANCELLED",
        "ACCOUNT_LINK_REQUIRED",
        "GOOGLE_AUTH_FAILED",
        "GOOGLE_EXPIRED",
        "APPLE_NOT_CONFIGURED",
        "APPLE_CANCELLED",
        "APPLE_AUTH_FAILED",
        "APPLE_EXPIRED",
        "APPLE_ALREADY_PENDING",
      ].includes(code)
        ? errorText(code, locale)
        : "";
    });
  useEffect(() => {
    const url = new URL(location.href);
    if (url.searchParams.has("authError")) {
      url.searchParams.delete("authError");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, []);
  async function signIn(provider) {
    if (busy || authController.current) return;
    setBusy(true);
    setActiveProvider(provider);
    setError("");
    authController.current = new AbortController();
    try {
      const begin = provider === "apple" ? beginAppleSignIn : beginGoogleSignIn;
      await begin({ signal: authController.current.signal });
      if (native) await onReady();
    } catch (e) {
      setError(errorText(e.message, locale));
    } finally {
      setBusy(false);
      setActiveProvider(null);
      authController.current = null;
    }
  }
  async function retry() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onRetry();
    } catch (e) {
      setError(errorText(e.message, locale));
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/auth/" + (register ? "register" : "login"), {
        email,
        password,
        invite,
        platform: ios ? "ios" : native ? "desktop" : "web",
      });
      await onReady(register);
    } catch (e) {
      setError(errorText(e.message, locale));
    } finally {
      setBusy(false);
    }
  }
  if (introOpen) return <Welcome onComplete={() => {
    try { localStorage.setItem("rankwisp-introduction-v1", "seen"); } catch {}
    setIntroOpen(false);
  }} />;
  return (
    <main className="auth-page">
      <a className="auth-brand" href={"/" + locale}>
        <Brand />
      </a>
      <button
        className="locale-button auth-language"
        onClick={() => setLocale(locale === "en" ? "de" : "en")}
      >
        <Globe size={15} />
        {locale.toUpperCase()}
      </button>
      <div className="auth-story">
        <span className="eyebrow">
          {tr("A CLEARER WAY FORWARD", "EIN KLARER WEG NACH VORN")}
        </span>
        <h1>
          {tr(
            "Good apps deserve to be found.",
            "Gute Apps verdienen es, gefunden zu werden.",
          )}
        </h1>
        <p>
          {tr(
            "Meet the small signals that help your next big idea grow.",
            "Entdecke die kleinen Signale, die deine nächste grosse Idee weiterbringen.",
          )}
        </p>
      </div>
      <section className="auth-card">
        <span className="auth-icon">
          <img src="/brand/symbol.png" width="52" height="52" alt="" />
        </span>
        <h2>
          {register
            ? tr(
                "Make room for your next move.",
                "Platz für deinen nächsten Schritt.",
              )
            : tr("Welcome back.", "Willkommen zurück.")}
        </h2>
        <p>
          {register
            ? tr(
                "24 days to explore. No card. No automatic charge.",
                "24 Tage entdecken. Ohne Karte. Ohne automatische Abbuchung.",
              )
            : tr(
                "Let’s see what your app is telling you.",
                "Schauen wir, was deine App dir zeigt.",
              )}
        </p>
        {(error || notice) && (
          <div className="notice error" role="alert">
            <span>{error || notice.text}</span>
            <button
              type="button"
              className="text-button"
              onClick={retry}
              disabled={busy}
            >
              <RefreshCw size={14} />
              {tr("Try again", "Erneut versuchen")}
            </button>
          </div>
        )}
        <Button
          className="google-button"
          variant="secondary"
          onClick={() => signIn("google")}
          loading={activeProvider === "google"}
          aria-busy={activeProvider === "google"}
          disabled={busy || config.googleConfigured === false}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.36Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.41 13.92a6.04 6.04 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.96c1.47 0 2.79.5 3.83 1.5L18.7 4.6A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59A5.97 5.97 0 0 1 12 5.96Z"
            />
          </svg>
          {tr("Continue with Google", "Mit Google fortfahren")}
        </Button>
        <Button
          className="apple-button"
          onClick={() => signIn("apple")}
          loading={activeProvider === "apple"}
          aria-busy={activeProvider === "apple"}
          disabled={busy || config.appleConfigured !== true}
          aria-describedby={config.appleConfigured !== true ? "apple-availability" : undefined}
        >
          {/* Official Apple logo-only button artwork; bundled to avoid a third-party request.
              https://appleid.cdn-apple.com/appleid/button/logo?color=white&height=32&width=32 */}
          <img width="30" height="30" alt="" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAAAXNSR0IArs4c6QAAAUBJREFUSInt18GNgzAQBdA/aO82FQQqWKgA6CAdoFSCUwmUQAl0gKkAdxBSwd9LciW2QkBaZSROaPzkbxsL4FEkDcmRn6uRZPP05IFaAL/Yp6yI5BFJsyMKABlJIzvP9llWSHJnFAAQHYFuBi/Lsi9srUWe5+i6Lrz5nYNZFAWVUpznObj3rRlrrTEMA5IkCe4Ngo0xiOMYcRzjcrkgTVNUVQURQVVVsNb6D+YbTdM0BLD6tG3rHbU3rJRaRYui8EbJgDW+3++r78uy9I8ZG35AnHNhDb7RnE6n1ai11hxH/1vVG67r+uXm0lpvD8/z/BKu63p7mFw/Ukop3m4377F+QvaDMQbLssA5h/P5jCRJ0Pc9nHMwxkBr7T3W9z7+wv8Tng5wpwhAfwDcH/ELM4lIFgGAiGQArvhs7BOA68PCH+OXVCbGYKn8AAAAAElFTkSuQmCC" />
          {tr("Continue with Apple", "Mit Apple fortfahren")}
        </Button>
        {activeProvider && (
          <p className="auth-provider-progress" role="status">
            {activeProvider === "apple"
              ? tr("Complete your Apple sign-in in the browser.", "Schliesse deine Apple-Anmeldung im Browser ab.")
              : tr("Complete your Google sign-in in the browser.", "Schliesse deine Google-Anmeldung im Browser ab.")}
          </p>
        )}
        {activeProvider && native && (
          <button
            className="text-button auth-cancel"
            onClick={() => authController.current?.abort()}
          >
            {tr("Cancel sign-in", "Anmeldung abbrechen")}
          </button>
        )}
        {config.googleConfigured === false && (
          <p className="auth-provider-note">
            {config.authProvider === "google"
              ? tr(
                  "Google sign-in has not been enabled for this service yet. Contact support for access.",
                  "Google-Anmeldung ist für diesen Dienst noch nicht freigeschaltet. Kontaktiere den Support für Zugang.",
                )
              : tr(
                  "Google sign-in is not available yet. You can use email below.",
                  "Google-Anmeldung ist noch nicht verfügbar. Du kannst unten E-Mail verwenden.",
                )}
          </p>
        )}
        {config.appleConfigured !== true && (
          <p id="apple-availability" className="auth-provider-note">
            {tr("Apple sign-in is not configured for this service yet.", "Apple-Anmeldung ist für diesen Dienst noch nicht eingerichtet.")}
          </p>
        )}
        {config.authProvider !== "google" && (
          <button
            className="email-disclosure"
            aria-expanded={emailOpen}
            disabled={busy}
            onClick={() => setEmailOpen(!emailOpen)}
          >
            <Mail size={15} />
            {tr("Continue with email", "Mit E-Mail fortfahren")}
            <ChevronDown size={15} />
          </button>
        )}
        {emailOpen && config.authProvider !== "google" && (
          <div className="email-auth">
            <form onSubmit={submit}>
              <label className="field">
                {tr("Email", "E-Mail")}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="field">
                {tr("Password", "Passwort")}
                <input
                  aria-label={tr("Password", "Passwort")}
                  type="password"
                  minLength="12"
                  required
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {register && (
                  <span>
                    {tr("At least 12 characters.", "Mindestens 12 Zeichen.")}
                  </span>
                )}
              </label>
              {register && !config.registrationOpen && (
                <label className="field">
                  {tr("Preview invitation", "Vorschau-Einladung")}
                  <input
                    value={invite}
                    onChange={(e) => setInvite(e.target.value)}
                  />
                </label>
              )}
              <Button type="submit" loading={busy && !activeProvider} disabled={busy}>
                {register
                  ? tr("Start my 24 days", "Meine 24 Tage starten")
                  : tr("Sign in", "Anmelden")}{" "}
                <ArrowRight size={16} />
              </Button>
            </form>
            <button
              className="text-button auth-toggle"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register
                ? tr(
                    "Already have an account? Sign in",
                    "Schon ein Konto? Anmelden",
                  )
                : tr(
                    "New here? Start your free trial",
                    "Neu hier? Kostenlos testen",
                  )}
            </button>
          </div>
        )}
        <a className="auth-demo" href="/app/?demo=1">
          {tr("Take a look around first", "Zuerst einen Blick hineinwerfen")}{" "}
          <ArrowUpRight size={14} />
        </a>
        <button className="text-button" disabled={busy} onClick={() => setIntroOpen(true)}>{tr("A quick introduction", "Eine kurze Einführung")}</button>
        <p className="auth-fine">
          {tr(
            "Development preview. Purchases are not yet open.",
            "Entwicklungsvorschau. Käufe sind noch nicht freigeschaltet.",
          )}{" "}
          <a href={`/${locale}/privacy`}>{tr("Privacy", "Datenschutz")}</a>
        </p>
      </section>
    </main>
  );
}
function Competitors({
  project,
  keyword,
  keywords,
  onSelectKeyword,
  demo,
  action,
}) {
  const { tr, locale, number, date } = useLocale();
  const [editing, setEditing] = useState(false),
    [query, setQuery] = useState(""),
    [results, setResults] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const v = visibility(project, demo ? Date.UTC(2026, 10, 17, 13) : Date.now());
  const apps = [
    { id: project.appleID, name: project.name, ...project.metadata, own: true },
    ...(project.competitors ?? []),
  ];
  async function find(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api(
        `/competitors?id=${project.appleID}&country=${project.country}&term=${encodeURIComponent(query)}`,
      );
      setResults(r.results);
    } catch (e) {
      setError(errorText(e.message, locale));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="competition-intro competition-intro-compact">
        <p>
          {tr(
            "Compare the same keyword across your selected apps.",
            "Vergleiche dasselbe Keyword für deine gewählten Apps.",
          )}
        </p>
        <Button onClick={() => setEditing(true)}>
          <Plus size={16} />
          {tr("Review selection", "Auswahl prüfen")}
        </Button>
      </div>
      <KeywordStandings
        project={project}
        keyword={keyword}
        keywords={keywords}
        onSelectKeyword={onSelectKeyword}
      />
      <details className="standings-comparison-details">
        <summary>
          <span>
            <strong>
              {tr(
                "App details & comparison model",
                "App-Details und Vergleichsmodell",
              )}
            </strong>
            <small>
              {tr(
                "Metadata, modelled shares and how they are calculated",
                "Metadaten, modellierte Anteile und ihre Berechnung",
              )}
            </small>
          </span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <div className="standings-comparison-content">
          <div className="competitor-grid">
            {apps.map((a) => {
              const score = v.values.find((x) => x.id === a.id);
              return (
                <article
                  className={"competitor-card " + (a.own ? "own" : "")}
                  key={a.id}
                >
                  <div className="competitor-card-top">
                    <AppIcon app={a} size={54} />
                    <span className="pill">
                      {a.own
                        ? tr("Your app", "Deine App")
                        : tr("Selected comparison", "Gewählter Vergleich")}
                    </span>
                  </div>
                  <h3>{a.name}</h3>
                  <p>
                    {a.developer ||
                      tr("Metadata not loaded", "Metadaten nicht geladen")}
                  </p>
                  <StoreLink app={a} country={project.country} />
                  <div className="visibility-number">
                    {score?.share != null
                      ? number(score.share, {
                          style: "percent",
                          maximumFractionDigits: 1,
                        })
                      : "—"}
                    <small>
                      {tr(
                        "modelled visibility share",
                        "modellierter Sichtbarkeitsanteil",
                      )}
                    </small>
                  </div>
                  <div className="share-bar">
                    <i style={{ width: `${(score?.share || 0) * 100}%` }} />
                  </div>
                  <div className="quality-row">
                    <span>{tr("Public rating", "Öffentliche Bewertung")}</span>
                    <strong>
                      {a.rating != null
                        ? number(a.rating, { maximumFractionDigits: 1 }) + "/5"
                        : "—"}
                    </strong>
                  </div>
                  <div className="quality-row">
                    <span>Version</span>
                    <strong>{a.version || "—"}</strong>
                  </div>
                  {a.fetchedAt && (
                    <p className="small muted">
                      {tr("Retrieved", "Abgerufen")} {date(a.fetchedAt)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          <section className="panel method-panel">
            <Info size={22} />
            <div>
              <h3>
                {tr(
                  "A comparison model. Not market share.",
                  "Ein Vergleichsmodell. Kein Marktanteil.",
                )}
              </h3>
              <p>
                {tr(
                  "Each selected app scores 1 ÷ rank per included keyword. Shares divide that score by the total for your selected apps. Keywords have equal weight. Only fresh Core observations without a current error are included. A missing result contributes zero.",
                  "Jede gewählte App erhält je einbezogenem Keyword 1 ÷ Rang Punkte. Der Anteil ergibt sich aus der Summe aller gewählten Apps. Keywords zählen gleich. Einbezogen werden nur aktuelle Kernbegriffe ohne aktuellen Fehler. Fehlende Treffer zählen null.",
                )}
              </p>
              <p>
                <strong>
                  {tr("Included keywords", "Einbezogene Keywords")}:
                </strong>{" "}
                {v.included.join(", ") ||
                  tr(
                    "None yet. Review keyword groups first.",
                    "Noch keine. Prüfe zuerst die Keyword-Gruppen.",
                  )}
              </p>
              <p className="small muted">
                {tr(
                  "Changing keywords or competitors changes the denominator. It is not organic ranking growth. No download, user or revenue market share is measured.",
                  "Andere Keywords oder Konkurrenten ändern die Berechnungsbasis. Das ist kein organisches Ranking-Wachstum. Download-, Nutzer- und Umsatzmarktanteile werden nicht gemessen.",
                )}
              </p>
            </div>
          </section>
          <Button
            variant="secondary"
            onClick={() =>
              action("metadata", () =>
                api(`/projects/${project.id}/metadata`, {}),
              )
            }
          >
            <RefreshCw size={15} />
            {tr("Refresh app metadata", "App-Metadaten aktualisieren")}
          </Button>
          {project.lastMetadataError && (
            <div className="notice error">
              {errorText(project.lastMetadataError, locale)}
            </div>
          )}
        </div>
      </details>
      {editing && (
        <Modal
          title={tr("Your comparison set", "Deine Vergleichsauswahl")}
          onClose={() => setEditing(false)}
        >
          <p>
            {tr(
              "Remove any app that does not belong. Your historical search results remain intact.",
              "Entferne Apps, die nicht passen. Die historischen Suchergebnisse bleiben erhalten.",
            )}
          </p>
          {(project.competitors ?? []).map((a) => (
            <div className="app-result" key={a.id}>
              <AppIcon app={a} />
              <strong>{a.name}</strong>
              <Button
                variant="ghost"
                onClick={() =>
                  action("remove", () =>
                    api(
                      `/projects/${project.id}/competitors`,
                      {
                        ids: project.competitors
                          .filter((x) => x.id !== a.id)
                          .map((x) => x.id),
                      },
                      "PATCH",
                    ),
                  )
                }
              >
                {tr("Remove", "Entfernen")}
              </Button>
            </div>
          ))}
          <form className="search-form" onSubmit={find}>
            <input
              required
              placeholder={tr(
                "Search a shared function",
                "Nach gemeinsamer Funktion suchen",
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={tr("Competitor search", "Konkurrenzsuche")}
            />
            <Button loading={busy}>{tr("Search", "Suchen")}</Button>
          </form>
          {error && <div className="notice error">{error}</div>}
          {results
            ?.filter((a) => !project.competitors?.some((c) => c.id === a.id))
            .map((a) => (
              <div className="app-result" key={a.id}>
                <AppIcon app={a} />
                <div className="result-copy">
                  <strong>{a.name}</strong>
                  <span>
                    {a.reason.sameCategory
                      ? tr("Same category", "Gleiche Kategorie")
                      : tr("Search match", "Suchtreffer")}{" "}
                    · “{a.reason.query}”
                  </span>
                  <StoreLink app={a} country={project.country} />
                </div>
                <Button
                  variant="secondary"
                  disabled={project.competitors?.length >= 5}
                  onClick={() =>
                    action("add", () =>
                      api(
                        `/projects/${project.id}/competitors`,
                        {
                          ids: [
                            ...(project.competitors ?? []).map((x) => x.id),
                            a.id,
                          ],
                        },
                        "PATCH",
                      ),
                    )
                  }
                >
                  <Plus size={14} />
                  {tr("Add", "Hinzufügen")}
                </Button>
              </div>
            ))}
        </Modal>
      )}
    </>
  );
}
function SettingsPage({
  me,
  workspace,
  config,
  action,
  notify,
  exportData,
  importClick,
  onReauthenticated,
  onDeleted,
}) {
  const { tr, locale, setLocale, date } = useLocale();
  const [settingsTab, setSettingsTab] = useState("plan");
  const settingsTabs = [
    ["plan", tr("Plan & usage", "Lizenz")],
    ["preferences", tr("Preferences", "Präferenzen")],
    ["data", tr("Your data", "Deine Daten")],
    ["account", tr("Account", "Konto")],
  ];
  const [terms, setTerms] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [password, setPassword] = useState(""),
    [recoveries, setRecoveries] = useState(null);
  const signInProvider = (me.authProvider || me.account?.authProvider) === "apple" ? "apple" : "google";
  const socialOnly =
    me.hasPassword === false || me.account?.hasPassword === false;
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  useEffect(() => {
    setDeleteConfirmation("");
    setPassword("");
    setDeleteOpen(false);
  }, [me.account.id]);
  const [changeOpen, setChangeOpen] = useState(false),
    [newPassword, setNewPassword] = useState("");
  async function purchase() {
    await action("purchase", async () => {
      if (ios) {
        const result = await Store.purchase({ accountToken: me.account.id });
        await api("/billing/apple", {
          signedTransaction: result.signedTransaction,
        });
        await Store.finish({ transactionID: result.transactionID });
      } else {
        const result = await api("/billing/checkout", { acceptTerms: terms });
        window.location.assign(result.url);
      }
    });
  }
  async function restore() {
    await action("restore", async () => {
      if (ios) {
        const result = await Store.restore();
        for (const tx of result.transactions) {
          await api("/billing/apple", {
            signedTransaction: tx.signedTransaction,
          });
          await Store.finish({ transactionID: tx.transactionID });
        }
      }
      const restored = await api("/billing/restore", {});
      notify(
        restored.license.state === "paid"
          ? tr("Your purchase is restored.", "Dein Kauf ist wiederhergestellt.")
          : tr(
              "No active purchase is linked to this account.",
              "Mit diesem Konto ist kein aktiver Kauf verbunden.",
            ),
        "info",
      );
    });
  }
  return (
    <div className="settings-grid" data-tab={settingsTab}>
      <nav
        className="settings-tabs"
        role="tablist"
        aria-label={tr("Settings sections", "Einstellungsbereiche")}
      >
        {settingsTabs.map(([id, label], index) => (
          <button
            role="tab"
            key={id}
            id={"settings-tab-" + id}
            aria-controls={"settings-panel-" + id}
            aria-selected={settingsTab === id}
            tabIndex={settingsTab === id ? 0 : -1}
            onClick={() => setSettingsTab(id)}
            onKeyDown={(e) => {
              let next;
              if (e.key === "ArrowRight")
                next = (index + 1) % settingsTabs.length;
              if (e.key === "ArrowLeft")
                next = (index + settingsTabs.length - 1) % settingsTabs.length;
              if (e.key === "Home") next = 0;
              if (e.key === "End") next = settingsTabs.length - 1;
              if (next !== undefined) {
                e.preventDefault();
                setSettingsTab(settingsTabs[next][0]);
                document
                  .getElementById("settings-tab-" + settingsTabs[next][0])
                  ?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <section
        className="panel settings-panel"
        data-setting="plan"
        role="tabpanel"
        id="settings-panel-plan"
        aria-labelledby="settings-tab-plan"
      >
        <span className="eyebrow">
          {tr("SIMPLE BY DESIGN", "BEWUSST EINFACH")}
        </span>
        <h2>{tr("One purchase. Yours to keep.", "Ein Kauf. Deine Lizenz.")}</h2>
        <p>
          {tr(
            "A proposed CHF 49 one-time licence. No auto-renewal. No card needed for your 24-day trial.",
            "Vorgesehen: CHF 49 einmalig. Keine automatische Verlängerung. Keine Karte für deine 24-tägige Testphase.",
          )}
        </p>
        <div className="license-summary">
          <strong>
            {me.license.state === "paid"
              ? tr("Purchased", "Gekauft")
              : me.license.state === "expired"
                ? tr("Trial ended", "Testphase beendet")
                : tr("Free trial", "Kostenlose Testphase")}
          </strong>
          <span>
            {me.license.trialEndsAt &&
              date(me.license.trialEndsAt, { dateStyle: "long" })}
          </span>
        </div>
        <div className="usage-grid">
          <div>
            <strong>{me.license.checksRemaining}</strong>
            <span>{tr("cloud checks left", "Cloud-Abfragen übrig")}</span>
          </div>
          <div>
            <strong>{me.license.aiRemaining}</strong>
            <span>{tr("AI notes left", "KI-Hinweise übrig")}</span>
          </div>
          {me.storage && (
            <div>
              <strong>
                {(me.storage.bytes / 1048576).toFixed(1)} /{" "}
                {(me.storage.limitBytes / 1048576).toFixed(0)}
              </strong>
              <span>
                {tr("MB workspace storage", "MB Arbeitsbereich-Speicher")}
              </span>
            </div>
          )}
        </div>
        <p className="small muted">
          {tr(
            "Trial: 120 checks + 8 AI notes. Purchase: 5,000 total checks + 100 total AI notes, including trial usage. Budget limits also apply. No unlimited lifetime cloud service. Each workspace includes 16 MB of stored history. Reading and exporting always remain available.",
            "Testphase: 120 Abfragen + 8 KI-Hinweise. Kauf: insgesamt 5’000 Abfragen + 100 KI-Hinweise, inklusive Testnutzung. Zusätzlich gelten Kostenlimits. Kein unbegrenzter lebenslanger Cloud-Dienst. Jeder Arbeitsbereich enthält 16 MB für gespeicherte Verläufe. Lesen und Exportieren bleiben verfügbar.",
          )}
        </p>
        {me.license.state === "pending" && (
          <>
            <Button
              disabled={!config.applePaymentsConfigured}
              onClick={() =>
                action("trial", async () => {
                  const result = await Store.purchase({
                    accountToken: me.account.id,
                    trial: true,
                  });
                  await api("/billing/apple", {
                    signedTransaction: result.signedTransaction,
                  });
                  await Store.finish({ transactionID: result.transactionID });
                })
              }
            >
              {tr("Start 24-day free trial", "24 Tage kostenlos starten")}
            </Button>
            <p className="small muted">
              {tr(
                "Requires the free “24-day Trial” App Store product. Unavailable in this unsigned preview.",
                "Benötigt das kostenlose App-Store-Produkt „24-day Trial“. In dieser unsignierten Vorschau nicht verfügbar.",
              )}
            </p>
          </>
        )}
        {me.license.state !== "paid" && (
          <>
            <label className="check-field">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              <span>
                {tr(
                  "I have read the terms and the included allowances.",
                  "Ich habe die Bedingungen und enthaltenen Kontingente gelesen.",
                )}{" "}
                <a href={`/${locale}/terms`}>{tr("Terms", "Bedingungen")}</a>
              </span>
            </label>
            <Button
              onClick={purchase}
              disabled={
                !terms ||
                (ios
                  ? !config.applePaymentsConfigured
                  : !config.paymentsConfigured)
              }
            >
              {tr("Buy once", "Einmal kaufen")} <ArrowUpRight size={15} />
            </Button>
            {!config.paymentsConfigured && !ios && (
              <p className="small muted">
                {tr(
                  "Purchases open after merchant setup and legal review.",
                  "Käufe werden nach Händler-Einrichtung und Rechtsprüfung freigeschaltet.",
                )}
              </p>
            )}
          </>
        )}
        <button className="text-button" onClick={restore}>
          {tr("Restore purchase", "Kauf wiederherstellen")}
        </button>
      </section>
      <section
        className="panel settings-panel"
        data-setting="preferences"
        role="tabpanel"
        id="settings-panel-preferences"
        aria-labelledby="settings-tab-preferences"
      >
        <h2>{tr("Make yourself at home.", "Richte dich ein.")}</h2>
        <label className="field">
          {tr("Language", "Sprache")}
          <select value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={!!workspace?.automaticUpdates}
            onChange={(e) =>
              action("automatic", () =>
                api(
                  "/preferences",
                  { automaticUpdates: e.target.checked },
                  "PATCH",
                ),
              )
            }
          />
          <span>
            <strong>
              {tr("Daily cloud observations", "Tägliche Cloud-Messungen")}
            </strong>
            <small>
              {tr(
                "When the server is running, refresh due keywords. Each attempt uses one check. Missed days stay empty.",
                "Bei laufendem Server fällige Keywords abrufen. Jeder Versuch verbraucht eine Abfrage. Verpasste Tage bleiben leer.",
              )}
            </small>
          </span>
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={!!me.telemetry}
            onChange={(e) =>
              action("telemetry", () =>
                api("/preferences", { telemetry: e.target.checked }, "PATCH"),
              )
            }
          />
          <span>
            <strong>
              {tr("Optional product analytics", "Optionale Produkt-Analytics")}
            </strong>
            <small>
              {tr(
                "Share aggregate feature counts. No keywords, app names, recordings or ad trackers. Off by default; retained for 30 days.",
                "Aggregierte Funktionsaufrufe teilen. Keine Keywords, App-Namen, Aufzeichnungen oder Werbetracker. Standardmässig aus; 30 Tage Aufbewahrung.",
              )}
            </small>
          </span>
        </label>
        <p className="small muted">
          {tr(
            "Motion follows your system’s Reduce Motion preference. Website analytics are separate and currently disabled.",
            "Animationen respektieren die Systemeinstellung „Bewegung reduzieren“. Website-Analytics sind separat und derzeit deaktiviert.",
          )}
        </p>
      </section>
      <section
        className="panel settings-panel"
        data-setting="data"
        role="tabpanel"
        id="settings-panel-data"
        aria-labelledby="settings-tab-data"
      >
        <h2>
          {tr("Your data travels with you.", "Deine Daten bleiben bei dir.")}
        </h2>
        <p>
          {tr(
            "Export your full history, import a Rankblick workspace, or retrieve a recovery copy.",
            "Exportiere deinen gesamten Verlauf, importiere einen Rankblick-Arbeitsbereich oder lade eine Sicherung.",
          )}
        </p>
        <div className="settings-actions">
          <Button variant="secondary" onClick={exportData}>
            <Download size={16} />
            {tr("Export everything", "Alles exportieren")}
          </Button>
          <Button variant="secondary" onClick={importClick}>
            <FileUp size={16} />
            {tr("Import Rankblick", "Rankblick importieren")}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              action("recoveries", async () =>
                setRecoveries(await api("/imports")),
              )
            }
          >
            {tr("Show import backups", "Importsicherungen anzeigen")}
          </Button>
        </div>
        {recoveries && (
          <div>
            {recoveries.length ? (
              recoveries.map((r) => (
                <button
                  key={r.id}
                  className="recovery-row"
                  onClick={() =>
                    action("recovery", async () =>
                      exportFile(
                        await api("/imports/" + r.id),
                        "rankwisp-recovery.json",
                      ),
                    )
                  }
                >
                  {date(r.created, { dateStyle: "medium", timeStyle: "short" })}
                  <Download size={15} />
                </button>
              ))
            ) : (
              <p className="small muted">
                {tr("No imports yet.", "Noch keine Importe.")}
              </p>
            )}
          </div>
        )}
        <div className="notice">
          {tr(
            "App Store Connect reports remain available in the original Rankblick app. No Connect key has been copied into this product.",
            "App-Store-Connect-Berichte bleiben in der ursprünglichen Rankblick-App verfügbar. Es wurde kein Connect-Schlüssel in dieses Produkt kopiert.",
          )}
        </div>
      </section>
      <section
        className="panel settings-panel"
        data-setting="account"
        role="tabpanel"
        id="settings-panel-account"
        aria-labelledby="settings-tab-account"
      >
        <h2>{tr("Account & privacy", "Konto & Datenschutz")}</h2>
        <p>{me.account.email}</p>
        <a
          href="https://github.com/Yann1s2/Rankwisp"
          target="_blank"
          rel="noopener noreferrer"
          className="text-button settings-source-link"
        >
          {tr("Source code on GitHub", "Quellcode auf GitHub")}{" "}
          <ExternalLink size={13} />
        </a>
        <a href="mailto:info@zhstudio.ch" className="text-button">
          <Mail size={16} />
          info@zhstudio.ch
        </a>
        <p>
          {tr(
            "Provider keys belong on the server. Never paste one into this app or a support message.",
            "Anbieter-Schlüssel gehören auf den Server. Füge sie niemals in diese App oder eine Supportnachricht ein.",
          )}
        </p>
        <div className="settings-actions">
          {!socialOnly && (
            <Button variant="secondary" onClick={() => setChangeOpen(true)}>
              {tr("Change password", "Passwort ändern")}
            </Button>
          )}
          {socialOnly && (
            <span className="pill">
              {signInProvider === "apple" ? tr("Signed in with Apple", "Mit Apple angemeldet") : tr("Signed in with Google", "Mit Google angemeldet")}
            </span>
          )}
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            {tr("Delete my account", "Mein Konto löschen")}
          </Button>
        </div>
      </section>
      {changeOpen && (
        <Modal
          title={tr("Change your password", "Passwort ändern")}
          onClose={() => setChangeOpen(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              action("password", async () => {
                await api("/auth/password", {
                  current: password,
                  password: newPassword,
                });
                setPassword("");
                setNewPassword("");
                setChangeOpen(false);
              });
            }}
          >
            <label className="field">
              {tr("Current password", "Aktuelles Passwort")}
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="field">
              {tr("New password", "Neues Passwort")}
              <input
                type="password"
                autoComplete="new-password"
                minLength="12"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <Button>{tr("Save password", "Passwort speichern")}</Button>
          </form>
        </Modal>
      )}
      {deleteOpen && (
        <Modal
          title={tr("Delete this account?", "Dieses Konto löschen?")}
          onClose={() => setDeleteOpen(false)}
        >
          <p>
            {tr(
              "This permanently deletes your workspace, import backups and sessions on this server. Export first if you want to keep them. Purchases are not automatically refunded.",
              "Dies löscht deinen Arbeitsbereich, Importsicherungen und Sitzungen auf diesem Server dauerhaft. Exportiere sie vorher, wenn du sie behalten möchtest. Käufe werden nicht automatisch erstattet.",
            )}
          </p>
          {socialOnly ? (
            <label className="field">
              {tr("Type DELETE to confirm", "Zur Bestätigung DELETE eingeben")}
              <input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                autoComplete="off"
              />
              <span>
                {signInProvider === "apple"
                  ? tr("A recent Apple sign-in is required. You may be asked to sign in again.", "Eine aktuelle Apple-Anmeldung ist nötig. Möglicherweise musst du dich erneut anmelden.")
                  : tr("A recent Google sign-in is required. You may be asked to sign in again.", "Eine aktuelle Google-Anmeldung ist nötig. Möglicherweise musst du dich erneut anmelden.")}
              </span>
            </label>
          ) : (
            <label className="field">
              {tr(
                "Confirm with your password",
                "Mit deinem Passwort bestätigen",
              )}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
          )}
          <Button
            variant="danger"
            disabled={socialOnly ? deleteConfirmation !== "DELETE" : !password}
            onClick={() =>
              action("delete", async () => {
                try {
                  await api(
                    "/account",
                    socialOnly ? { confirm: "DELETE" } : { password },
                    "DELETE",
                  );
                } catch (e) {
                  if (!socialOnly || e.message !== "REAUTH_REQUIRED") throw e;
                  await (signInProvider === "apple" ? beginAppleSignIn : beginGoogleSignIn)();
                  if (native) {
                    await onReauthenticated();
                    setDeleteConfirmation("");
                    setDeleteOpen(false);
                    notify(
                      tr(
                        "Signed in again. Review the account shown in Settings before requesting deletion again.",
                        "Erneut angemeldet. Prüfe das in den Einstellungen angezeigte Konto, bevor du das Löschen erneut anforderst.",
                      ),
                      "info",
                    );
                  }
                  return;
                }
                clearToken();
                setDeleteOpen(false);
                onDeleted();
              })
            }
          >
            {tr(
              "Permanently delete my account",
              "Mein Konto dauerhaft löschen",
            )}
          </Button>
        </Modal>
      )}
    </div>
  );
}
