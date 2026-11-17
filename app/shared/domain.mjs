import { z } from "zod";
export const DAY = 86400000;
export const COUNTRIES = [
  "us",
  "gb",
  "ch",
  "de",
  "at",
  "fr",
  "it",
  "es",
  "ca",
  "au",
  "nl",
  "se",
  "no",
  "dk",
  "jp",
  "kr",
  "br",
  "in",
  "mx",
  "nz",
];
const date = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid date");
const id = z.union([z.string().min(1).max(100), z.number().int().positive()]);
const result = z
  .object({ id: z.number().int().positive(), name: z.string().max(500) })
  .passthrough();
const sample = z
  .object({
    id,
    date,
    rank: z.number().int().min(1).max(200).nullable().optional(),
    resultCount: z.number().int().min(0),
    results: z.array(result).max(1000),
    source: z.string().optional(),
    httpDate: z.string().optional(),
    cacheAge: z.string().optional(),
  })
  .passthrough();
const keyword = z
  .object({
    id,
    text: z.string().min(1).max(100),
    category: z
      .enum(["core", "brand", "adjacent", "unclassified"])
      .nullable()
      .optional(),
    samples: z.array(sample),
    archived: z.boolean(),
    lastError: z.string().nullable().optional(),
    lastAttempt: date.optional(),
  })
  .passthrough();
const project = z
  .object({
    id,
    appleID: z.number().int().positive(),
    name: z.string().min(1).max(500),
    country: z.string().regex(/^[a-z]{2}$/),
    keywords: z.array(keyword),
    archived: z.boolean(),
    competitors: z.array(result).optional(),
    storeSnapshots: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();
export const workspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    automaticUpdates: z.boolean(),
    projects: z.array(project).max(100),
  })
  .passthrough();
export const emptyWorkspace = () => ({
  schemaVersion: 1,
  automaticUpdates: false,
  projects: [],
});
export function parseImport(input) {
  const original = input.workspace ?? input;
  const data = workspaceSchema.parse(original);
  const ids = new Set();
  for (const p of data.projects) {
    if (ids.has(String(p.id))) throw Error("DUPLICATE_PROJECT");
    ids.add(String(p.id));
    const seen = new Set();
    for (const k of p.keywords) {
      if (seen.has(String(k.id))) throw Error("DUPLICATE_KEYWORD");
      seen.add(String(k.id));
    }
  }
  return {
    data,
    summary: {
      projects: data.projects.length,
      keywords: data.projects.reduce((a, p) => a + p.keywords.length, 0),
      samples: data.projects.reduce(
        (a, p) => a + p.keywords.reduce((n, k) => n + k.samples.length, 0),
        0,
      ),
    },
  };
}
export function normalizeKeywords(text) {
  return [
    ...new Set(
      text
        .split(/[,;\n]/)
        .map((x) => x.trim().replace(/\s+/g, " ").toLocaleLowerCase())
        .filter(Boolean),
    ),
  ];
}
export function parseAppQuery(text) {
  const q = text.trim();
  if (/^\d{5,15}$/.test(q)) return { id: q };
  if (/^https?:\/\//i.test(q)) {
    const u = new URL(q);
    if (
      u.protocol !== "https:" ||
      u.hostname !== "apps.apple.com" ||
      u.username ||
      u.password ||
      u.port
    )
      throw Error("INVALID_APP_URL");
    const match = u.pathname.match(/\/id(\d{5,15})(?:\/|$)/);
    if (!match) throw Error("INVALID_APP_URL");
    return { id: match[1] };
  }
  if (!q || q.length > 100) throw Error("INVALID_QUERY");
  return { term: q };
}
export function latest(k) {
  return [...k.samples]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .at(-1);
}
export function quality(k, now = Date.now()) {
  if (k.lastError) return "error";
  const s = latest(k);
  if (!s) return "unmeasured";
  if (now - Date.parse(s.date) > DAY) return "stale";
  return s.rank == null ? "missing" : "fresh";
}
export function segments(samples, appID) {
  const dedup = new Map();
  samples.forEach((s) => dedup.set(Date.parse(s.date), s));
  const out = [];
  let line = [];
  let previous;
  for (const [time, s] of [...dedup].sort((a, b) => a[0] - b[0])) {
    const r = appID ? s.results.findIndex((x) => x.id === appID) + 1 : s.rank;
    const rank = r === 0 ? null : r;
    if (rank == null || (previous && time - previous > 36 * 3600000)) {
      if (line.length) out.push(line);
      line = [];
    }
    if (rank != null) line.push({ time, rank, sample: s });
    previous = time;
  }
  if (line.length) out.push(line);
  return out;
}
export function visibility(project, now = Date.now(), category = "core") {
  const included = project.keywords.filter(
    (k) =>
      !k.archived &&
      (k.category ?? "unclassified") === category &&
      !["error", "stale", "unmeasured"].includes(quality(k, now)),
  );
  const apps = [
    { id: project.appleID, name: project.name },
    ...(project.competitors ?? []),
  ];
  const values = apps.map((a) => ({
    ...a,
    score: included.reduce((n, k) => {
      const rank = latest(k).results.findIndex((r) => r.id === a.id) + 1;
      return n + (rank ? 1 / rank : 0);
    }, 0),
  }));
  const total = values.reduce((n, a) => n + a.score, 0);
  return {
    included: included.map((k) => k.text),
    values: values.map((a) => ({
      ...a,
      share: total && apps.length > 1 ? a.score / total : null,
    })),
  };
}
export function license(account, now = Date.now()) {
  const start = Object.hasOwn(account, "trial_started")
    ? account.trial_started
    : account.created;
  const end = (start ?? 0) + 24 * DAY;
  const paid = account.license === "paid";
  return {
    state: paid
      ? "paid"
      : start === null
        ? "pending"
        : now < end
          ? "trial"
          : "expired",
    trialStartedAt: start === null ? null : new Date(start).toISOString(),
    trialEndsAt: start === null ? null : new Date(end).toISOString(),
    daysRemaining:
      start === null ? 24 : Math.max(0, Math.ceil((end - now) / DAY)),
    readable: true,
    writable: paid || (start !== null && now < end),
    checksRemaining: Math.max(0, (paid ? 5000 : 120) - account.checks),
    aiRemaining: Math.max(0, (paid ? 100 : 8) - account.ai_count),
    aiSpent: account.ai_spent,
  };
}
export function suggestionEvidence(project) {
  return {
    app: { id: project.appleID, name: project.name, store: project.country },
    keywords: project.keywords
      .filter((k) => !k.archived)
      .slice(0, 50)
      .map((k) => ({
        keyword: k.text,
        category: k.category ?? "unclassified",
        quality: quality(k),
        observations: k.samples
          .slice(-7)
          .map((s) => ({
            date: s.date,
            rank: s.rank ?? null,
            resultCount: s.resultCount,
          })),
        error: Boolean(k.lastError),
      })),
    competitors: (project.competitors ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      reason: c.reason ?? null,
    })),
    method:
      "Apple Search API result order, not device search, volume or market share",
  };
}
