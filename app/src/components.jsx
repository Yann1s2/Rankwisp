import React, { useState, useId, useRef, useEffect } from "react";
import { line, curveMonotoneX } from "d3-shape";
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
export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <img src="/mark.svg" width="34" height="34" alt="" />
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
        <img src="/wisp.svg" width="132" height="118" alt="" />
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
const colors = ["#111D4A", "#92140C", "#aa6b25"];
export function Chart({
  keyword,
  comparison = [],
  days = 30,
  illustration = false,
}) {
  const { tr, date } = useLocale();
  const [hover, setHover] = useState(null);
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 900, height: 260 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(240, Math.round(entry.contentRect.width));
      const height = Math.max(110, Math.round(entry.contentRect.height));
      setChartSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [keyword?.id, keyword?.samples?.length]);
  const { width, height } = chartSize;
  const pad = { left: 30, right: 18, top: 15, bottom: 27 };
  const all = keyword?.samples ?? [];
  const end = illustration ? Date.UTC(2026, 10, 17, 13) : Date.now();
  const filtered = all.filter(
    (s) => days === 0 || Date.parse(s.date) >= end - days * 86400000,
  );
  const series = [
    { id: null, name: tr("Your app", "Deine App") },
    ...comparison,
  ].map((a, i) => ({
    ...a,
    color: colors[i % 3],
    segments: segments(filtered, a.id),
  }));
  const points = series[0].segments.flat();
  const timeValues = filtered.map((s) => Date.parse(s.date));
  const min = Math.min(...timeValues),
    max = Math.max(...timeValues);
  const highest = Math.max(
    10,
    ...series.flatMap((s) => s.segments.flat()).map((p) => p.rank),
  );
  const ceiling = Math.ceil(highest / 10) * 10;
  const x = (t) =>
    pad.left +
    ((t - min) / Math.max(1, max - min)) * (width - pad.left - pad.right);
  const y = (r) =>
    pad.top + ((r - 1) / (ceiling - 1)) * (height - pad.top - pad.bottom);
  const path = line()
    .x((p) => x(p.time))
    .y((p) => y(p.rank))
    .curve(curveMonotoneX);
  const selectAt = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    if (points.length)
      setHover(
        points.reduce((a, b) =>
          Math.abs(x(a.time) - px) < Math.abs(x(b.time) - px) ? a : b,
        ),
      );
  };
  if (!filtered.length)
    return (
      <Empty
        title={tr(
          "Your story starts with a measurement.",
          "Dein Verlauf beginnt mit einer Messung.",
        )}
      >
        {tr(
          "Add a keyword and refresh to see your first real position.",
          "Füge ein Keyword hinzu und aktualisiere für deine erste echte Position.",
        )}
      </Empty>
    );
  return (
    <div className="chart-wrap">
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        <span className="muted">
          {tr("Lower rank is better", "Kleinerer Rang ist besser")}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={tr(
          "Observed keyword positions over time. Exact values are in the measurement table.",
          "Gemessene Keyword-Positionen im Verlauf. Exakte Werte stehen in der Messtabelle.",
        )}
        onPointerMove={selectAt}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFCF99" stopOpacity=".23" />
            <stop offset="100%" stopColor="#FFCF99" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[1, ...[0.33, 0.66, 1].map((n) => Math.round(ceiling * n))].map(
          (rank) => (
            <g key={rank}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(rank)}
                y2={y(rank)}
                stroke="#ded8d1"
                strokeDasharray="3 5"
              />
              <text x="4" y={y(rank) + 4}>
                {rank}
              </text>
            </g>
          ),
        )}
        {series.map((s, si) =>
          s.segments.map((seg, i) => (
            <g key={s.name + i}>
              {si === 0 && seg.length > 1 && (
                <path
                  d={
                    path(seg) +
                    `L${x(seg.at(-1).time)},${height - pad.bottom}L${x(seg[0].time)},${height - pad.bottom}Z`
                  }
                  fill={`url(#${uid})`}
                />
              )}
              <path
                d={path(seg) || ""}
                fill="none"
                stroke={s.color}
                strokeWidth={si === 0 ? 3 : 1.8}
                strokeDasharray={si ? "4 5" : undefined}
              />
              {seg.map((p, j) => (
                <circle
                  key={j}
                  cx={x(p.time)}
                  cy={y(p.rank)}
                  r={seg.length === 1 ? 4 : 2}
                  fill={s.color}
                />
              ))}
            </g>
          )),
        )}
        {[...new Set([min, (min + max) / 2, max])]
          .filter(Number.isFinite)
          .map((time, i) => (
            <text
              key={time}
              x={x(time)}
              y={height - 5}
              textAnchor={i === 0 ? "start" : time === max ? "end" : "middle"}
            >
              {date(time)}
            </text>
          ))}
        {hover && (
          <g>
            <line
              x1={x(hover.time)}
              x2={x(hover.time)}
              y1={pad.top}
              y2={height - pad.bottom}
              stroke="#97a58d"
            />
            <circle
              cx={x(hover.time)}
              cy={y(hover.rank)}
              r="5"
              fill="#294737"
              stroke="white"
              strokeWidth="3"
            />
          </g>
        )}
      </svg>
      <div className="chart-caption" aria-live="polite">
        {hover ? (
          <strong>
            {date(hover.time, {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · #{hover.rank}
          </strong>
        ) : (
          tr(
            "Real observations. Smooth connections. Gaps stay visible.",
            "Echte Messpunkte. Weiche Verbindungen. Lücken bleiben sichtbar.",
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
