import React, { useId } from "react";
import { latest } from "../shared/domain.mjs";
import { AppIcon, StoreLink } from "./components";
import { useLocale } from "./i18n";
import "./keyword-standings.css";

// A read-only view of one stored search response, never a relative score.
export function KeywordStandings({
  project,
  keyword,
  keywords,
  onSelectKeyword,
}) {
  const { tr, date, number } = useLocale();
  const id = useId();
  if (!project) return null;
  const choices = (keywords || project.keywords || []).filter(
    (item) => !item.archived,
  );
  const selected = keyword || choices[0];
  const sample = selected
    ? latest({ ...selected, samples: selected.samples || [] })
    : undefined;
  const results = sample?.results || [];
  const ownID = Number(project.appleID);
  const apps = [
    {
      ...project.metadata,
      id: ownID,
      name: project.metadata?.name || project.name,
      own: true,
    },
    ...(project.competitors || [])
      .filter((app) => Number(app.id) !== ownID)
      .slice(0, 5),
  ];
  const unique = new Set();
  const rows = apps
    .filter((app) => {
      if (unique.has(Number(app.id))) return false;
      unique.add(Number(app.id));
      return true;
    })
    .map((app) => {
      const result = results.find((item) => Number(item.id) === Number(app.id));
      const position =
        results.findIndex((item) => Number(item.id) === Number(app.id)) + 1;
      const rank = app.own ? sample?.rank : position || null;
      // The selected app's metadata supplies real artwork; older imports may lack it.
      const snapshot = [...(project.storeSnapshots || [])]
        .reverse()
        .find((item) => Number(item.id) === Number(app.id));
      return {
        ...snapshot,
        ...result,
        ...app,
        icon: app.icon || snapshot?.icon || result?.icon,
        notRecorded: !!sample && app.own && sample.rank === undefined,
        rank: Number.isInteger(rank) && rank > 0 ? rank : null,
      };
    })
    .sort(
      (a, b) =>
        (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
        Number(b.own) - Number(a.own),
    );
  const knownDate = sample && Number.isFinite(Date.parse(sample.date));
  const source =
    sample?.source === "apple-search-v1"
      ? "Apple Search API"
      : sample?.source === "illustration"
        ? tr("Fictional demo", "Fiktive Demo")
        : sample?.source || tr("Not recorded", "Nicht erfasst");
  return (
    <section className="keyword-standings" aria-labelledby={`${id}-heading`}>
      <header className="keyword-standings-heading">
        <div>
          <h2 id={`${id}-heading`}>
            {tr("Keyword rankings", "Keyword-Rangliste")}
          </h2>
          <p>
            {tr("Selected apps", "Gewählte Apps")} ·{" "}
            {String(project.country || "").toUpperCase()}
          </p>
        </div>
        <label className="keyword-standings-selector">
          <span className="sr-only">
            {tr("Ranking keyword", "Keyword der Rangliste")}
          </span>
          <select
            value={selected?.id ?? ""}
            disabled={!choices.length || !onSelectKeyword}
            onChange={(event) => {
              const next = choices.find(
                (item) => String(item.id) === event.target.value,
              );
              if (next) onSelectKeyword?.(next.id);
            }}
          >
            {!choices.length && (
              <option value="">{tr("No keywords", "Keine Keywords")}</option>
            )}
            {selected &&
              !choices.some(
                (item) => String(item.id) === String(selected.id),
              ) && <option value={selected.id}>{selected.text}</option>}
            {choices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.text}
              </option>
            ))}
          </select>
        </label>
      </header>
      {selected?.lastError && (
        <p className="keyword-standings-warning" role="status">
          {tr(
            "Latest refresh failed. Saved data remains unchanged.",
            "Letzte Aktualisierung fehlgeschlagen. Gespeicherte Daten bleiben unverändert.",
          )}
        </p>
      )}
      <ul
        className="keyword-standings-list"
        aria-label={tr("Absolute search positions", "Absolute Suchpositionen")}
      >
        {rows.map((app) => (
          <li key={app.id} className={app.own ? "is-own" : ""}>
            <span
              className={`keyword-standings-rank ${app.rank == null ? "is-missing" : ""}`}
            >
              {sample && app.rank != null ? (
                <>
                  <span className="sr-only">{tr("Position", "Position")} </span>
                  #{number(app.rank)}
                </>
              ) : (
                <span aria-hidden="true">—</span>
              )}
            </span>
            <AppIcon app={app} size={34} />
            <div className="keyword-standings-app">
              <strong title={app.name}>{app.name}</strong>
              <span>
                {!sample
                  ? tr("Not measured", "Ungemessen")
                  : app.notRecorded
                    ? tr("Position not recorded", "Position nicht erfasst")
                    : app.rank == null
                      ? tr(
                          "Not found in this response",
                          "In dieser Antwort nicht gefunden",
                        )
                      : app.own
                        ? tr("Your app", "Deine App")
                        : app.developer ||
                          tr("Selected comparison", "Gewählter Vergleich")}
              </span>
            </div>
            {app.own && (
              <span className="keyword-standings-own">{tr("You", "Du")}</span>
            )}
            <StoreLink app={app} country={project.country} />
          </li>
        ))}
      </ul>
      <footer className="keyword-standings-meta">
        {sample ? (
          <>
            <div>
              <span>
                {tr("Retrieved", "Abgerufen")}{" "}
                {knownDate ? (
                  <time dateTime={sample.date}>
                    {date(sample.date, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                ) : (
                  "—"
                )}
              </span>
              <span>
                {Number.isInteger(sample.resultCount)
                  ? number(sample.resultCount)
                  : "—"}{" "}
                {tr("results", "Treffer")}
              </span>
            </div>
            <p title={source}>
              {tr("Source", "Quelle")}: {source} ·{" "}
              {tr(
                "API positions, not device rankings",
                "API-Positionen, keine Geräte-Ränge",
              )}
            </p>
          </>
        ) : (
          <p>
            {tr(
              "Refresh this keyword to see actual search positions.",
              "Aktualisiere dieses Keyword für echte Suchpositionen.",
            )}
          </p>
        )}
      </footer>
    </section>
  );
}
