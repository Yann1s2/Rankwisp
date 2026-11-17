import { hash, transaction } from "./db.mjs";
import { parseAppQuery } from "../shared/domain.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function appleClient(db, { fetcher = fetch, spacing = 3300 } = {}) {
  let tail = Promise.resolve();
  const pending = new Map();
  async function request(params, { fresh = false } = {}) {
    const key = "apple:" + hash(JSON.stringify(params));
    const cached = db.prepare("SELECT * FROM cache WHERE key=?").get(key);
    if (!fresh && cached && Date.now() - cached.created < 3600000)
      return { ...JSON.parse(cached.value), cached: true };
    if (pending.has(key)) return pending.get(key);
    const run = tail.then(async () => {
      const slot = transaction(db, () => {
        const now = Date.now();
        const previous =
          db.prepare("SELECT value FROM counters WHERE key='apple-next'").get()
            ?.value ?? 0;
        const at = Math.max(now, Math.min(previous, now + 60000));
        db.prepare(
          "INSERT INTO counters VALUES('apple-next',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        ).run(at + spacing);
        return at;
      });
      await sleep(Math.max(0, slot - Date.now()));
      const url = new URL(
        "https://itunes.apple.com/" + (params.id ? "lookup" : "search"),
      );
      Object.entries({
        ...params,
        entity: "software",
        media: "software",
        limit: 200,
      }).forEach(([k, v]) => url.searchParams.set(k, String(v)));
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(20000),
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!response.ok)
        throw Error(
          response.status === 429 ? "APPLE_RATE_LIMIT" : "APPLE_UNAVAILABLE",
        );
      const body = await response.json();
      if (
        !Array.isArray(body.results) ||
        body.results.some(
          (x) =>
            !Number.isSafeInteger(x.trackId) || typeof x.trackName !== "string",
        )
      )
        throw Error("APPLE_INVALID_RESPONSE");
      const fetchedAt = new Date().toISOString();
      const value = {
        results: body.results.map((a) => ({
          id: a.trackId,
          name: a.trackName,
          developer: a.artistName ?? "",
          genre: a.primaryGenreName ?? "",
          description: (a.description ?? "").slice(0, 12000),
          icon: safeIcon(a.artworkUrl512 ?? a.artworkUrl100),
          url: `https://apps.apple.com/${params.country}/app/id${a.trackId}`,
          rating: a.averageUserRating ?? null,
          ratingCount: a.userRatingCount ?? null,
          version: a.version ?? null,
          releasedAt: a.currentVersionReleaseDate ?? null,
          fetchedAt,
        })),
        fetchedAt,
        httpDate: response.headers.get("date"),
        cacheAge: response.headers.get("age"),
        cached: false,
      };
      db.prepare("INSERT OR REPLACE INTO cache VALUES(?,?,?)").run(
        key,
        Date.now(),
        JSON.stringify(value),
      );
      return value;
    });
    tail = run.catch(() => {});
    pending.set(key, run);
    try {
      return await run;
    } finally {
      pending.delete(key);
    }
  }
  return {
    request,
    search: (q, country) => request({ ...parseAppQuery(q), country }),
  };
}
export function safeIcon(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.endsWith(".mzstatic.com")
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function competitors(own, candidates, term) {
  return candidates
    .filter((a) => a.id !== own.id)
    .map((a) => {
      const category = a.genre && a.genre === own.genre;
      const words = new Set(
        (own.name + " " + own.genre)
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 2),
      );
      const overlap = a.name
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => words.has(w));
      return {
        ...a,
        reason: {
          query: term,
          sameCategory: !!category,
          sharedWords: [...new Set(overlap)],
          differentDeveloper: a.developer !== own.developer,
        },
        score:
          (category ? 3 : 0) +
          overlap.length +
          (a.developer !== own.developer ? 1 : 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
