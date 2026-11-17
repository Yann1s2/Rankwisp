import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { api } from "./api";
import { Button } from "./components";
import { useLocale, errorText } from "./i18n";

const keywordKey = (value) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function appendKeywordSuggestions(draft, suggestions) {
  const seen = new Set(draft.split(/[,;\n]/).map(keywordKey));
  const additions = suggestions
    .map((word) => word.trim().replace(/\s+/g, " "))
    .filter((word) => {
      const key = keywordKey(word);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return additions.length
    ? draft + (draft.trim() ? "\n" : "") + additions.join("\n")
    : draft;
}

export default function KeywordSuggestions({
  appleID,
  country,
  existingKeywords = [],
  available,
  consent,
  onConsent,
  onUsageChange,
  onApply,
  initiallyOpen = false,
  demo = false,
}) {
  const { tr, locale } = useLocale();
  const [open, setOpen] = useState(initiallyOpen);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [requestedConsent, setRequestedConsent] = useState(!!consent);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState(null);
  const request = useRef(0);
  useEffect(() => {
    ++request.current;
    setRequestedConsent(!!consent);
    setRows([]);
    setSource(null);
    setMessage("");
    setBusy(false);
    return () => {
      ++request.current;
    };
  }, [appleID, country, locale, consent]);
  const unavailable = (reason) =>
    ({
      CONSENT_REQUIRED: tr(
        "Allow sharing below before requesting suggestions.",
        "Erlaube zuerst unten die Datenfreigabe für Vorschläge.",
      ),
      AI_NOT_CONFIGURED: tr(
        "AI suggestions are not available yet. You can enter keywords manually.",
        "KI-Vorschläge sind noch nicht verfügbar. Du kannst Keywords manuell eingeben.",
      ),
      AI_INPUT_LIMIT: tr(
        "This app’s details are too long for a suggestion request. You can enter keywords manually.",
        "Die App-Angaben sind für eine Vorschlagsanfrage zu lang. Du kannst Keywords manuell eingeben.",
      ),
      AI_NO_SUGGESTIONS: tr(
        "No additional ideas were returned. Your existing draft is unchanged.",
        "Es wurden keine zusätzlichen Ideen geliefert. Dein bestehender Entwurf bleibt unverändert.",
      ),
      AI_BUDGET: tr(
        "Your AI allowance has been reached. Manual keywords remain available.",
        "Dein KI-Kontingent ist aufgebraucht. Manuelle Keywords bleiben verfügbar.",
      ),
      AI_UNAVAILABLE: tr(
        "Suggestions are temporarily unavailable. Try again or enter your own keywords.",
        "Vorschläge sind vorübergehend nicht verfügbar. Versuche es erneut oder gib eigene Keywords ein.",
      ),
      APPLE_UNAVAILABLE: tr(
        "The app’s public details could not be loaded. Try again later or enter keywords manually.",
        "Die öffentlichen App-Angaben konnten nicht geladen werden. Versuche es später oder gib Keywords manuell ein.",
      ),
      APPLE_APP_NOT_FOUND: tr(
        "This app could not be found in the selected storefront. Check your selection or enter keywords manually.",
        "Diese App wurde im gewählten Store-Land nicht gefunden. Prüfe deine Auswahl oder gib Keywords manuell ein.",
      ),
    })[reason] || errorText(reason, locale);
  async function generate() {
    if (!available || !consent || busy || demo) return;
    const id = ++request.current;
    setBusy(true);
    setMessage("");
    try {
      const data = await api("/keyword-suggestions", {
        appleID: Number(appleID),
        country,
        locale,
        existingKeywords: existingKeywords
          .filter((x) => typeof x === "string" && x.length <= 100)
          .slice(0, 100),
      });
      if (id !== request.current) return;
      onUsageChange?.();
      if (data.mode !== "ai") {
        setMessage(unavailable(data.reason));
        return;
      }
      const seen = new Set(existingKeywords.map(keywordKey));
      const next = (Array.isArray(data.suggestions) ? data.suggestions : [])
        .filter((item) => {
          const key =
            typeof item.keyword === "string" ? keywordKey(item.keyword) : "";
          if (!key || key.length > 60 || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 10)
        .map((item, index) => ({
          id: index,
          keyword: item.keyword.trim(),
          reason:
            typeof item.reason === "string" ? item.reason.slice(0, 200) : "",
          selected: true,
        }));
      setRows(next);
      setSource({ model: data.model, cached: data.cached });
      if (!next.length)
        setMessage(
          tr(
            "No new suggestions were returned. Your existing draft is unchanged.",
            "Es wurden keine neuen Vorschläge geliefert. Dein bestehender Entwurf bleibt unverändert.",
          ),
        );
    } catch (error) {
      if (id === request.current) setMessage(errorText(error.message, locale));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  async function changeConsent(value) {
    setRequestedConsent(value);
    setSavingConsent(true);
    setMessage("");
    try {
      await onConsent(value);
    } catch (error) {
      setRequestedConsent(!!consent);
      setMessage(errorText(error.message, locale));
    } finally {
      setSavingConsent(false);
    }
  }
  const selected = rows.filter((row) => row.selected && row.keyword.trim());
  const invalid = selected.some((row) => /[,;\n]/.test(row.keyword));
  function apply() {
    if (!selected.length || invalid) return;
    onApply(selected.map((row) => row.keyword));
    setRows((previous) => previous.map((row) => ({ ...row, selected: false })));
    setMessage(
      tr(
        "Selected ideas were appended to your draft. Review it before saving.",
        "Ausgewählte Ideen wurden an deinen Entwurf angehängt. Prüfe ihn vor dem Speichern.",
      ),
    );
  }
  return (
    <section
      className="keyword-suggestions"
      aria-label={tr("Keyword suggestions", "Keyword-Vorschläge")}
    >
      <button
        type="button"
        className="suggestions-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>{tr("Keyword suggestions", "Keyword-Vorschläge")}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="suggestions-content">
          <p>
            {tr(
              "Get a short list from your app’s public details using your AI allowance. Edit the wording, choose what fits, then add it to your draft.",
              "Erhalte mit deinem KI-Kontingent eine kurze Liste aus den öffentlichen App-Angaben. Passe die Formulierungen an, wähle passende Begriffe und übernimm sie in deinen Entwurf.",
            )}
          </p>
          {demo ? (
            <p className="muted">
              {tr(
                "Sign in with your own app to request AI suggestions.",
                "Melde dich mit deiner eigenen App an, um KI-Vorschläge anzufordern.",
              )}
            </p>
          ) : !available ? (
            <p className="muted">{unavailable("AI_NOT_CONFIGURED")}</p>
          ) : (
            <label className="check-field suggestions-consent">
              <input
                type="checkbox"
                checked={requestedConsent}
                disabled={savingConsent || busy}
                onChange={(event) => changeConsent(event.target.checked)}
              />
              <span>
                {tr(
                  "Allow app metadata and keywords to be shared with OpenAI. This uses your existing AI sharing preference.",
                  "App-Metadaten und Keywords mit OpenAI teilen. Dies verwendet deine bestehende KI-Freigabe.",
                )}
              </span>
            </label>
          )}
          {!rows.length && (
            <Button
              type="button"
              variant="secondary"
              loading={busy}
              disabled={!available || !consent || savingConsent || demo}
              onClick={generate}
            >
              {tr("Suggest keywords", "Keywords vorschlagen")}
              <ArrowRight size={14} />
            </Button>
          )}
          {rows.length > 0 && (
            <>
              <div className="suggestion-rows">
                {rows.map((row, index) => (
                  <div className="suggestion-row" key={row.id}>
                    <input
                      type="checkbox"
                      checked={row.selected}
                      aria-label={tr(
                        `Select suggestion ${index + 1}`,
                        `Vorschlag ${index + 1} auswählen`,
                      )}
                      onChange={(event) =>
                        setRows((previous) =>
                          previous.map((item) =>
                            item.id === row.id
                              ? { ...item, selected: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    <div>
                      <input
                        type="text"
                        value={row.keyword}
                        maxLength={60}
                        aria-label={tr(
                          `Suggestion ${index + 1}`,
                          `Vorschlag ${index + 1}`,
                        )}
                        onChange={(event) =>
                          setRows((previous) =>
                            previous.map((item) =>
                              item.id === row.id
                                ? { ...item, keyword: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      {row.reason && <p>{row.reason}</p>}
                    </div>
                  </div>
                ))}
              </div>
              {invalid && (
                <p role="alert">
                  {tr(
                    "Keep one keyword per row; remove commas and semicolons.",
                    "Ein Keyword pro Zeile: Entferne Kommas und Semikolons.",
                  )}
                </p>
              )}
              <div className="suggestions-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={apply}
                  disabled={!selected.length || invalid}
                >
                  {tr("Use selected", "Auswahl übernehmen")} ({selected.length})
                </Button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setRows([]);
                    setSource(null);
                    setMessage("");
                  }}
                >
                  {tr("Discard suggestions", "Vorschläge verwerfen")}
                </button>
              </div>
              {source?.model && (
                <small className="muted">
                  {source.model}
                  {source.cached
                    ? tr(" · saved suggestions", " · gespeicherte Vorschläge")
                    : ""}
                </small>
              )}
            </>
          )}
          {message && (
            <p className="suggestions-message" role="status">
              {message}
            </p>
          )}
          <small className="muted">
            {tr(
              "Ideas to review, not measured ranks or search-volume estimates. Nothing is tracked until you save and refresh.",
              "Ideen zur Prüfung, keine gemessenen Ränge oder Suchvolumen-Schätzungen. Erst Speichern und Aktualisieren startet die Messung.",
            )}
          </small>
        </div>
      )}
    </section>
  );
}
