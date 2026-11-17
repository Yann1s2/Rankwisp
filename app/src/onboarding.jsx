import React, { useState, useRef } from "react";
import {
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  Compass,
  Globe,
  CheckCircle2,
} from "lucide-react";
import { api } from "./api";
import { useLocale, errorText } from "./i18n";
import { Button, AppIcon, StoreLink, Empty } from "./components";
import KeywordSuggestions, {
  appendKeywordSuggestions,
} from "./KeywordSuggestions";
import { normalizeKeywords } from "../shared/domain.mjs";
import { COUNTRIES } from "../shared/domain.mjs";
export default function Onboarding({
  onComplete,
  onCancel,
  config,
  aiConsent,
  onConsent,
  onUsageChange,
}) {
  const { tr, locale } = useLocale();
  const [step, setStep] = useState(0),
    [query, setQuery] = useState(""),
    [country, setCountry] = useState("us"),
    [results, setResults] = useState(null),
    [own, setOwn] = useState(null),
    [term, setTerm] = useState(""),
    [rivals, setRivals] = useState(null),
    [selected, setSelected] = useState([]),
    [keywords, setKeywords] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sequence = useRef(0);
  const countryNames = new Intl.DisplayNames([locale], { type: "region" });
  async function search(e) {
    e.preventDefault();
    const s = ++sequence.current;
    setError("");
    setBusy(true);
    try {
      const data = await api(
        "/search?q=" + encodeURIComponent(query) + "&country=" + country,
      );
      if (s === sequence.current) setResults(data.results);
    } catch (e) {
      if (s === sequence.current) setError(errorText(e.message, locale));
    } finally {
      if (s === sequence.current) setBusy(false);
    }
  }
  async function findRivals(e) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api(
        `/competitors?id=${own.id}&country=${country}&term=${encodeURIComponent(term)}`,
      );
      setRivals(data.results);
    } catch (e) {
      setError(errorText(e.message, locale));
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    setBusy(true);
    setError("");
    try {
      const project = await api("/projects", {
        appleID: own.id,
        country,
        competitorIDs: selected,
        keywords,
      });
      api("/telemetry", { surface: "app", event: "onboarding_complete" }).catch(
        () => {},
      );
      onComplete(project);
    } catch (e) {
      setError(errorText(e.message, locale));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="onboarding">
      <div className="onboarding-top">
        <span className="eyebrow">
          {tr("A little clarity starts here", "Hier beginnt der Überblick")}
        </span>
        <span className="muted">{step + 1} / 3</span>
      </div>
      <div className="step-track">
        {[0, 1, 2].map((s) => (
          <i key={s} className={s <= step ? "complete" : ""} />
        ))}
      </div>
      <h1>
        {
          [
            tr("First, find your app.", "Zuerst: Finde deine App."),
            tr("Choose your comparison.", "Wähle deinen Vergleich."),
            tr("What should we watch?", "Was möchtest du beobachten?"),
          ][step]
        }
      </h1>
      <p className="lede">
        {
          [
            tr(
              "A name, App Store link or ID. We’ll take it from there.",
              "Ein Name, App-Store-Link oder eine ID. Den Rest übernehmen wir.",
            ),
            tr(
              "Search for the problem your app solves. You decide which suggestions belong.",
              "Suche nach dem Problem, das deine App löst. Du entscheidest, welche Vorschläge passen.",
            ),
            tr(
              "Start small. A handful of relevant searches tells a clearer story.",
              "Beginne mit wenigen relevanten Suchbegriffen. So wird die Entwicklung verständlich.",
            ),
          ][step]
        }
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {step === 0 && (
        <>
          <form onSubmit={search} className="search-form">
            <label className="input-icon">
              <Search size={18} />
              <input
                autoFocus
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={tr(
                  "App name, link or ID",
                  "App-Name, Link oder ID",
                )}
                aria-label={tr("Find app", "App suchen")}
              />
            </label>
            <label className="store-select">
              <Globe size={16} />
              <select
                aria-label={tr("Storefront", "Store-Land")}
                value={country}
                onChange={(e) => {
                  sequence.current++;
                  setCountry(e.target.value);
                  setResults(null);
                  setOwn(null);
                  setBusy(false);
                }}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {countryNames.of(c.toUpperCase())}
                  </option>
                ))}
              </select>
            </label>
            <Button loading={busy} type="submit">
              {tr("Search", "Suchen")} <ArrowRight size={16} />
            </Button>
          </form>
          {results?.length === 0 && (
            <Empty
              title={tr(
                "No matching apps here.",
                "Keine passenden Apps gefunden.",
              )}
            >
              {tr(
                "Try a shorter name or switch storefront.",
                "Versuche einen kürzeren Namen oder einen anderen Store.",
              )}
            </Empty>
          )}
          <div className="app-results">
            {results?.slice(0, 24).map((app) => (
              <div className="app-result" key={app.id}>
                <AppIcon app={app} size={52} />
                <div className="result-copy">
                  <strong>{app.name}</strong>
                  <span>
                    {app.developer} · {app.genre}
                  </span>
                  <StoreLink app={app} country={country} />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setOwn(app);
                    setTerm(app.genre || app.name);
                    setStep(1);
                    setRivals(null);
                    setSelected([]);
                  }}
                >
                  {tr("Select", "Auswählen")} <Plus size={14} />
                </Button>
              </div>
            ))}
          </div>
          {results === null && (
            <div className="onboarding-tip">
              <Compass size={26} />
              <div>
                <strong>
                  {tr(
                    "The right storefront matters.",
                    "Der richtige Store zählt.",
                  )}
                </strong>
                <p>
                  {tr(
                    "Rankings differ by country. Each storefront keeps its own history.",
                    "Rankings unterscheiden sich je Land. Jeder Store erhält einen eigenen Verlauf.",
                  )}
                </p>
              </div>
            </div>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <div className="selected-app">
            <AppIcon app={own} />
            <div>
              <strong>{own.name}</strong>
              <span>
                {countryNames.of(country.toUpperCase())} ·{" "}
                {tr("Your app", "Deine App")}
              </span>
            </div>
            <CheckCircle2 size={19} />
          </div>
          <form className="search-form" onSubmit={findRivals}>
            <label className="input-icon">
              <Search size={18} />
              <input
                required
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                aria-label={tr("Competitor search", "Konkurrenzsuche")}
                placeholder={tr("e.g. daily planner", "z. B. Tagesplaner")}
              />
            </label>
            <Button type="submit" loading={busy}>
              {tr("Find suggestions", "Vorschläge finden")}
            </Button>
          </form>
          <p className="small muted">
            {tr(
              "Suggestions use search overlap and category. They are research hypotheses, not proven competitors. Select up to five.",
              "Vorschläge basieren auf Suchergebnissen und Kategorie. Sie sind Recherche-Hypothesen, keine bestätigten Konkurrenten. Wähle bis zu fünf.",
            )}
          </p>
          <div className="rival-results">
            {rivals?.map((app) => (
              <div
                key={app.id}
                className={
                  "rival-option " +
                  (selected.includes(app.id) ? "selected" : "")
                }
              >
                <button
                  className="rival-select"
                  aria-pressed={selected.includes(app.id)}
                  onClick={() =>
                    setSelected((s) =>
                      s.includes(app.id)
                        ? s.filter((x) => x !== app.id)
                        : s.length < 5
                          ? [...s, app.id]
                          : s,
                    )
                  }
                >
                  <AppIcon app={app} />
                  <div>
                    <strong>{app.name}</strong>
                    <span>
                      {app.reason.sameCategory
                        ? tr("Same category", "Gleiche Kategorie")
                        : tr("Search match", "Suchtreffer")}{" "}
                      · {app.genre}
                    </span>
                  </div>
                  <span className="checkbox">
                    {selected.includes(app.id) && <Check size={14} />}
                  </span>
                </button>
                <div className="rival-source">
                  <StoreLink app={app} country={country} />
                  <span>
                    {tr("Found for", "Gefunden für")} “{app.reason.query}”
                  </span>
                </div>
              </div>
            ))}
          </div>
          {rivals?.length === 0 && (
            <p>
              {tr(
                "No suggestions for this term. Try a more specific feature.",
                "Keine Vorschläge für diesen Begriff. Versuche eine konkrete Funktion.",
              )}
            </p>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <div className="selected-app">
            <AppIcon app={own} />
            <div>
              <strong>{own.name}</strong>
              <span>
                {selected.length}{" "}
                {tr("selected comparisons", "ausgewählte Vergleiche")}
              </span>
            </div>
          </div>
          <label className="field">
            {tr("Your first keywords", "Deine ersten Keywords")}
            <textarea
              rows="4"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={tr(
                "daily planner, focus timer, morning routine",
                "Tagesplaner, Fokus-Timer, Morgenroutine",
              )}
            />
            <span>
              {tr(
                "Separate with commas or new lines. You can add or archive them later.",
                "Mit Kommas oder Zeilenumbrüchen trennen. Später kannst du weitere hinzufügen oder archivieren.",
              )}
            </span>
          </label>
          <KeywordSuggestions
            appleID={own.id}
            country={country}
            existingKeywords={normalizeKeywords(keywords)}
            available={!!config?.aiConfigured}
            consent={aiConsent}
            onConsent={onConsent}
            onUsageChange={onUsageChange}
            onApply={(words) =>
              setKeywords((previous) =>
                appendKeywordSuggestions(previous, words),
              )
            }
          />
          <div className="notice">
            {tr(
              "Nothing is guessed: your first refresh creates the first measurement. New keywords start unclassified until you review them.",
              "Wir schätzen keine Werte: Erst dein erster Abruf erzeugt eine Messung. Neue Keywords bleiben bis zu deiner Prüfung unklassifiziert.",
            )}
          </div>
        </>
      )}
      <div className="onboarding-actions">
        <Button
          variant="ghost"
          onClick={() => (step ? setStep(step - 1) : onCancel())}
        >
          <ArrowLeft size={16} />
          {step ? tr("Back", "Zurück") : tr("Cancel", "Abbrechen")}
        </Button>
        {step === 1 && (
          <Button onClick={() => setStep(2)}>
            {selected.length
              ? tr("Continue", "Weiter")
              : tr(
                  "Continue without competitors",
                  "Ohne Konkurrenz fortfahren",
                )}{" "}
            <ArrowRight size={16} />
          </Button>
        )}
        {step === 2 && (
          <Button onClick={complete} loading={busy}>
            {tr("Create my workspace", "Arbeitsbereich erstellen")}{" "}
            <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
