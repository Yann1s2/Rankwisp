import React, { useState, useId, useRef, useEffect, useMemo } from "react";
import { line, area, curveMonotoneX, curveLinear } from "d3-shape";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  X,
  Check,
  ArrowDown,
  LoaderCircle,
  Sun,
  ExternalLink,
} from "lucide-react";
import { segments } from "../shared/domain.mjs";
import { useLocale } from "./i18n";
import "./chart-polish.css";
export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <img src="/brand/symbol.png" width="34" height="34" alt="" />
      {!compact && (
        <span>
          rankwisp<span className="brand-dot">.</span>
        </span>
      )}
    </span>
  );
}
export function Button({ children, variant = "", loading = false, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={"button " + variant + " " + (props.className || "")}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function AppIcon({ app, size = 44 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [app?.icon]);
  return app?.icon && !failed ? (
    <img
      className="app-icon"
      src={app.icon}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className="app-icon placeholder-icon"
      style={{ width: size, height: size }}
    >
      <Sun size={size * 0.52} />
    </span>
  );
}
export function StoreLink({ app, country = "us" }) {
  const { tr } = useLocale();
  return (
    <a
      className="store-link"
      href={`https://apps.apple.com/${country}/app/id${app.id}`}
      target="_blank"
      rel="noreferrer"
    >
      App Store <ExternalLink size={11} />
      <span className="sr-only"> — {app.name}</span>
    </a>
  );
}
export function Status({ value }) {
  const { tr } = useLocale();
  const labels = {
    fresh: tr("Fresh", "Aktuell"),
    stale: tr("Over 24h old", "Über 24 h alt"),
    missing: tr("Not found", "Nicht gefunden"),
    error: tr("Fetch failed", "Abruffehler"),
    unmeasured: tr("Not measured", "Ungemessen"),
  };
  return (
    <span className={"status " + value}>
      <i />
      {labels[value] || value}
    </span>
  );
}
export function Empty({ icon: Icon = Sun, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-symbol">
        <Icon size={25} strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const { tr } = useLocale();
  const ref = useRef();
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    const old = document.activeElement;
    el.showModal();
    return () => {
      el.close();
      old?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={tr("Close", "Schliessen")}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
const colors = ["#2B2D42", "#D80032", "#656b7c"];
export function Chart({
  keyword,
  comparison = null,
  days = 30,
  illustration = false,
}) {
  const { tr, date } = useLocale();
  const [selection, setSelection] = useState(null);
  const [smooth, setSmooth] = useState(true);
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 900, height: 200 });
  const all = keyword?.samples ?? [];
  const { filtered, series, points } = useMemo(() => {
    const end = illustration ? Date.UTC(2026, 10, 17, 13) : Date.now();
    const filtered = all.filter(
      (s) =>
        Number.isFinite(Date.parse(s.date)) &&
        (days === 0 || Date.parse(s.date) >= end - days * 86400000),
    );
    const series = [
      { id: null, name: tr("Your app", "Deine App") },
      ...(comparison || []),
    ].map((app, index) => ({
      ...app,
      color: colors[index % colors.length],
      index,
      segments: segments(filtered, app.id).map((segment) =>
        segment.filter(
          (point) => Number.isFinite(point.rank) && point.rank > 0,
        ),
      ),
    }));
    const points = series.flatMap((s) =>
      s.segments.flat().map((point) => ({ ...point, series: s })),
    );
    return { filtered, series, points };
  }, [all, comparison, days, illustration, tr]);
  const hasData = points.length > 0;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setChartSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [hasData]);
  const { width, height } = chartSize;
  const pad = { left: 32, right: 12, top: 16, bottom: 28 };
  const plotWidth = Math.max(1, width - pad.left - pad.right);
  const plotHeight = Math.max(1, height - pad.top - pad.bottom);
  const times = filtered.map((sample) => Date.parse(sample.date));
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : 0;
  const ceiling =
    Math.ceil(Math.max(10, ...points.map((point) => point.rank)) / 10) * 10;
  const x = (time) =>
    min === max
      ? pad.left + plotWidth / 2
      : pad.left + ((time - min) / (max - min)) * plotWidth;
  const y = (rank) => pad.top + ((rank - 1) / (ceiling - 1)) * plotHeight;
  // Monotone interpolation goes through every observation without overshooting.
  // Each segment is drawn independently: missing observations never get bridged.
  const curve = line()
    .x((point) => x(point.time))
    .y((point) => y(point.rank))
    .curve(smooth ? curveMonotoneX : curveLinear);
  const underfill = area()
    .x((point) => x(point.time))
    .y0(pad.top + plotHeight)
    .y1((point) => y(point.rank))
    .curve(smooth ? curveMonotoneX : curveLinear);
  const paths = useMemo(
    () =>
      new Map(
        series.flatMap((s) =>
          s.segments.map((segment) => [
            segment,
            { line: curve(segment), area: underfill(segment) },
          ]),
        ),
      ),
    [series, width, height, smooth],
  );
  const selected =
    selection?.keywordID === keyword?.id
      ? points.find(
          (point) =>
            point.time === selection.time &&
            point.series.index === selection.seriesIndex,
        )
      : null;
  const select = (point) =>
    setSelection(
      point
        ? {
            keywordID: keyword?.id,
            time: point.time,
            seriesIndex: point.series.index,
          }
        : null,
    );
  const selectAt = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height || !points.length) return;
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const py = ((event.clientY - rect.top) / rect.height) * height;
    // Snap to an observed timestamp first, then the nearest series at that time.
    const nearestTime = points.reduce((a, b) =>
      Math.abs(x(a.time) - px) <= Math.abs(x(b.time) - px) ? a : b,
    ).time;
    const candidates = points.filter((point) => point.time === nearestTime);
    select(
      candidates.reduce((a, b) =>
        Math.abs(y(a.rank) - py) <= Math.abs(y(b.rank) - py) ? a : b,
      ),
    );
  };
  const selectKey = (event) => {
    if (event.key === "Escape") {
      setSelection(null);
      return;
    }
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const currentSeries =
      selected?.series.index ??
      series.find((s) => s.segments.flat().length)?.index;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const available = series.filter((s) => s.segments.flat().length);
      const next =
        available[
          (available.findIndex((s) => s.index === currentSeries) +
            (event.key === "ArrowDown" ? 1 : available.length - 1)) %
            available.length
        ];
      const candidates = points.filter(
        (point) => point.series.index === next.index,
      );
      select(
        selected
          ? candidates.reduce((a, b) =>
              Math.abs(a.time - selected.time) <=
              Math.abs(b.time - selected.time)
                ? a
                : b,
            )
          : candidates.at(-1),
      );
      return;
    }
    const candidates = points.filter(
      (point) => point.series.index === currentSeries,
    );
    const index = selected
      ? candidates.findIndex((point) => point.time === selected.time)
      : candidates.length - 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? candidates.length - 1
          : Math.max(
              0,
              Math.min(
                candidates.length - 1,
                index + (event.key === "ArrowRight" ? 1 : -1),
              ),
            );
    select(candidates[next]);
  };
  if (!hasData)
    return (
      <div className="chart-wrap polished-chart chart-empty">
        <span className="chart-empty-mark" aria-hidden="true">
          <svg viewBox="0 0 100 38">
            <path d="M4 28 C20 28 20 12 36 12 M52 22 C70 22 72 8 94 8" />
            <circle cx="36" cy="12" r="3" />
            <circle cx="52" cy="22" r="3" />
          </svg>
        </span>
        <strong>
          {filtered.length
            ? tr(
                "No positions in this period",
                "Keine Positionen in diesem Zeitraum",
              )
            : tr(
                "Your first measurement starts the story",
                "Deine erste Messung startet den Verlauf",
              )}
        </strong>
        <p>
          {filtered.length
            ? tr(
                "Missing or unsuccessful measurements stay empty. Refresh to check again.",
                "Fehlende oder erfolglose Messungen bleiben leer. Aktualisiere für einen neuen Abruf.",
              )
            : tr(
                "Add a keyword and refresh to see its real position.",
                "Füge ein Keyword hinzu und aktualisiere für seine echte Position.",
              )}
        </p>
      </div>
    );
  const shortRange = max - min < 2 * 86400000;
  const ticks =
    min === max
      ? [min]
      : width < 420
        ? [min, max]
        : [min, (min + max) / 2, max];
  const exactDate = (time) =>
    date(time, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  const tooltipWidth = Math.min(width - 16, width < 420 ? 190 : 224);
  const tooltipLeft = selected
    ? Math.min(Math.max(8, x(selected.time) + 14), width - tooltipWidth - 8)
    : 8;
  const tooltipTop = selected
    ? Math.max(4, Math.min(y(selected.rank) - 76, height - 82))
    : 4;
  return (
    <div className="chart-wrap polished-chart">
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.index} className="chart-series-name" title={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        <label className="chart-smoothing">
          <input
            type="checkbox"
            checked={smooth}
            onChange={(event) => setSmooth(event.target.checked)}
          />
          {tr("Smooth curve", "Weiche Kurve")}
        </label>
        <span className="muted">
          {tr("Lower rank is better", "Kleinerer Rang ist besser")}
        </span>
      </div>
      <div className="chart-stage">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          tabIndex={0}
          aria-label={tr(
            "Observed keyword positions over time",
            "Gemessene Keyword-Positionen im Verlauf",
          )}
          aria-describedby={`${uid}-help ${uid}-caption`}
          onPointerMove={selectAt}
          onPointerDown={selectAt}
          onPointerLeave={(event) => {
            if (event.pointerType !== "touch") setSelection(null);
          }}
          onFocus={() => {
            if (!selected)
              select(
                points.filter((point) => point.series.index === 0).at(-1) ||
                  points.at(-1),
              );
          }}
          onBlur={() => setSelection(null)}
          onKeyDown={selectKey}
        >
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2B2D42" stopOpacity=".105" />
              <stop offset="100%" stopColor="#2B2D42" stopOpacity=".008" />
            </linearGradient>
          </defs>
          {[
            1,
            ...[1 / 3, 2 / 3, 1].map((value) => Math.round(ceiling * value)),
          ].map((rank) => (
            <g key={rank} className="chart-grid">
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(rank)}
                y2={y(rank)}
              />
              <text x={pad.left - 10} y={y(rank) + 3.5} textAnchor="end">
                {rank}
              </text>
            </g>
          ))}
          {series.map((s) =>
            s.segments.map((segment, index) => (
              <g key={`${s.index}-${index}`} data-chart-series={s.index}>
                {s.index === 0 && segment.length > 1 && (
                  <path
                    className="chart-underfill"
                    d={paths.get(segment).area}
                    fill={`url(#${uid}-fill)`}
                  />
                )}
                {segment.length > 1 && (
                  <path
                    className="chart-curve"
                    d={paths.get(segment).line}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.index === 0 ? 2.5 : 1.8}
                    strokeDasharray={s.index ? "5 5" : undefined}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {segment
                  .filter(
                    (point, index) =>
                      segment.length <= 60 ||
                      index === 0 ||
                      index === segment.length - 1,
                  )
                  .map((point) => (
                    <circle
                      key={point.time}
                      className="chart-observation"
                      cx={x(point.time)}
                      cy={y(point.rank)}
                      r={segment.length === 1 ? 4 : 2.5}
                      fill={s.color}
                      stroke="#edf2f4"
                      strokeWidth={segment.length === 1 ? 2 : 1.5}
                    />
                  ))}
              </g>
            )),
          )}
          {ticks.map((time, index) => (
            <text
              className="chart-time"
              key={time}
              x={x(time)}
              y={height - 6}
              textAnchor={
                min === max
                  ? "middle"
                  : index === 0
                    ? "start"
                    : time === max
                      ? "end"
                      : "middle"
              }
            >
              {date(
                time,
                shortRange && min !== max
                  ? { hour: "2-digit", minute: "2-digit" }
                  : { day: "numeric", month: "short" },
              )}
            </text>
          ))}
          {selected && (
            <g className="chart-crosshair" pointerEvents="none">
              <line
                x1={x(selected.time)}
                x2={x(selected.time)}
                y1={pad.top}
                y2={pad.top + plotHeight}
              />
              <circle
                cx={x(selected.time)}
                cy={y(selected.rank)}
                r="9"
                fill={selected.series.color}
                opacity=".10"
              />
              <circle
                cx={x(selected.time)}
                cy={y(selected.rank)}
                r="4.5"
                fill={selected.series.color}
                stroke="#edf2f4"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
        {selected && (
          <div
            className="chart-tooltip"
            aria-hidden="true"
            style={{ left: tooltipLeft, top: tooltipTop, width: tooltipWidth }}
          >
            <span className="chart-tooltip-date">
              {exactDate(selected.time)}
            </span>
            <div>
              <span className="chart-tooltip-name">
                <i style={{ background: selected.series.color }} />
                {selected.series.name}
              </span>
              <strong>#{selected.rank}</strong>
            </div>
          </div>
        )}
      </div>
      <span id={`${uid}-help`} className="sr-only">
        {tr(
          "Use left and right arrows for observations, up and down for apps, Home and End for first and last. Values are actual measurements, never interpolated.",
          "Mit Links und Rechts Messungen, mit Hoch und Runter Apps wählen. Pos1 und Ende wählen erste und letzte Messung. Werte sind echte Messungen, nie interpoliert.",
        )}
      </span>
      <div id={`${uid}-caption`} className="chart-caption" aria-live="polite">
        {selected ? (
          <strong>
            {selected.series.name} · {exactDate(selected.time)} · #
            {selected.rank}
          </strong>
        ) : points.length === 1 ? (
          tr(
            "One observation. The next measurement will start your curve.",
            "Eine Messung. Die nächste beginnt deine Verlaufskurve.",
          )
        ) : (
          tr(
            "Real observations. Tap or hover to inspect. Gaps stay visible.",
            "Echte Messpunkte. Tippen oder darüberfahren für Details. Lücken bleiben sichtbar.",
          )
        )}
      </div>
    </div>
  );
}
export function Delta({ current, previous }) {
  if (current == null || previous == null)
    return <span className="muted">—</span>;
  const n = previous - current;
  return (
    <span className={"delta " + (n > 0 ? "positive" : n < 0 ? "negative" : "")}>
      {n > 0 ? (
        <ArrowUpRight size={13} />
      ) : n < 0 ? (
        <ArrowDown size={13} />
      ) : null}
      {n === 0 ? "±0" : Math.abs(n)}
    </span>
  );
}
