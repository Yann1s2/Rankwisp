// Explicit opt-in network test: run only with worker/vitest.live.config.mjs.
// Synthetic local identity; no production sessions or user data are touched.
import { it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import worker from "../index.mjs";
import { hash } from "../../server/db-core.mjs";
import { randomToken } from "../auth.mjs";
it("real Apple search, lookup, project creation and persisted rank through local workerd", async () => {
  const id = crypto.randomUUID(),
    token = randomToken(),
    created = Date.now(),
    email = "apple-network-" + id + "@example.test";
  await env.IDENTITY.prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .bind(id, id, email, created, "web")
    .run();
  await env.IDENTITY.prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .bind(hash(token), id, created, created + 600000)
    .run();
  const stub = env.ACCOUNTS.getByName(id);
  await stub.initialize({ id, email, created, platform: "web" });
  async function call(path, body) {
    const response = await worker.fetch(
      new Request("https://rankwisp.pages.dev/api" + path, {
        method: body ? "POST" : "GET",
        headers: {
          authorization: "Bearer " + token,
          ...(body
            ? {
                "content-type": "application/json",
                origin: "https://rankwisp.pages.dev",
              }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      env,
    );
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBeLessThan(300);
    return result;
  }
  const search = await call("/search?country=us&q=Things%203");
  expect(search.results.some((a) => a.id === 904237743)).toBe(true);
  const lookup = await call("/search?country=us&q=904237743");
  expect(lookup.results[0].id).toBe(904237743);
  const project = await call("/projects", {
    appleID: 904237743,
    country: "us",
    competitorIDs: [],
    keywords: "Things 3",
  });
  const queued = await call("/projects/" + project.id + "/refresh", {});
  expect(queued.jobId).toBeTruthy();
  expect(await runDurableObjectAlarm(stub)).toBe(true);
  const job = await call("/jobs/" + queued.jobId);
  expect(job.status).toBe("completed");
  expect(job.completed).toBe(1);
  expect(job.errors).toBe(0);
  const { workspace } = await call("/workspace");
  const sample = workspace.projects[0].keywords[0].samples[0];
  expect(sample.source).toBe("apple-search-v1");
  expect(sample.rank).toBeGreaterThan(0);
  expect(sample.resultCount).toBeGreaterThan(0);
  expect(sample.results[sample.rank - 1].id).toBe(904237743);
  console.log(
    "LIVE_APPLE_EVIDENCE",
    JSON.stringify({
      checkedAt: new Date().toISOString(),
      searchCount: search.results.length,
      appID: project.appleID,
      appName: project.name,
      job: { completed: job.completed, errors: job.errors },
      sample: {
        date: sample.date,
        rank: sample.rank,
        resultCount: sample.resultCount,
        httpDate: sample.httpDate,
        source: sample.source,
      },
    }),
  );
});
