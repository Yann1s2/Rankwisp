import { DurableObject } from "cloudflare:workers";
import { sqliteAdapter } from "./sqlite.mjs";
import { requestRouter } from "./router.mjs";
import { createApp } from "../server/app.mjs";
import {
  emptyWorkspace,
  license,
  latest,
  DAY,
  parseAppQuery,
} from "../shared/domain.mjs";
import { advise } from "../server/ai.mjs";
import {
  applyPayment,
  applyAppleTrial,
  hash,
  rate,
} from "../server/db-core.mjs";
const safeUser = (u) => ({
  id: u.id,
  email: u.email,
  created: u.created,
  platform: u.platform,
});
export class AccountStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.db = sqliteAdapter(ctx.storage);
    this.db.exec("CREATE TABLE IF NOT EXISTS _deleted(value INTEGER NOT NULL)");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,words TEXT NOT NULL,status TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,errors INTEGER NOT NULL DEFAULT 0,total INTEGER NOT NULL,created INTEGER NOT NULL)",
    );
    const coordinator = () =>
      this.env.COORDINATOR.getByName("provider-coordination");
    const apple = {
      request: (p, o) => coordinator().appleRequest(p, o),
      search: (q, country) =>
        coordinator().appleRequest({ ...parseAppQuery(q), country }),
    };
    const roots = env.APPLE_ROOT_CERTS_BASE64
      ? JSON.parse(env.APPLE_ROOT_CERTS_BASE64).map((s) =>
          Buffer.from(s, "base64"),
        )
      : [];
    this.app = createApp(this.db, {
      env,
      apple,
      appFactory: requestRouter,
      externalAuth: true,
      rootCertificates: roots,
      authenticate: (req, _res, next) => {
        const account = this.db.prepare("SELECT * FROM accounts LIMIT 1").get();
        if (!account)
          return next(
            Object.assign(Error("SIGN_IN_REQUIRED"), { status: 401 }),
          );
        req.account = account;
        next();
      },
      ai: (db, account, project, options) =>
        advise(db, account, project, {
          ...options,
          reserveGlobal: (amount) => coordinator().reserveAI(amount),
        }),
    });
  }
  initialize(user) {
    if (this.db.prepare("SELECT value FROM _deleted LIMIT 1").get())
      throw Error("ACCOUNT_DELETED");
    const current = this.db.prepare("SELECT * FROM accounts LIMIT 1").get();
    if (current && current.id !== user.id) throw Error("ACCOUNT_MISMATCH");
    if (!current)
      this.db
        .prepare(
          "INSERT INTO accounts(id,email,password,created,workspace,trial_started) VALUES(?,?,?,?,?,?)",
        )
        .run(
          user.id,
          user.email,
          "google",
          user.created,
          JSON.stringify(emptyWorkspace()),
          user.platform === "ios" ? null : user.created,
        );
    return safeUser(user);
  }
  async handle(request, identity) {
    const a = this.db.prepare("SELECT * FROM accounts LIMIT 1").get();
    if (!a || a.id !== identity.id)
      return Response.json({ error: "SIGN_IN_REQUIRED" }, { status: 401 });
    const path = new URL(request.url).pathname;
    if (path === "/api/me")
      return Response.json({
        account: { id: a.id, email: a.email },
        license: license(a),
        aiConsent: !!a.ai_consent,
        telemetry: !!a.telemetry,
        authProvider: "google",
        hasPassword: false,
        storage: {
          bytes: new TextEncoder().encode(a.workspace).byteLength,
          limitBytes: 16777216,
        },
        reauthenticatedAt: identity.authenticated_at,
        serverTime: new Date().toISOString(),
      });
    const jobMatch = path.match(/^\/api\/jobs\/([A-Za-z0-9-]+)$/);
    if (request.method === "GET" && jobMatch) {
      const job = this.db
        .prepare("SELECT id,status,completed,errors,total FROM jobs WHERE id=?")
        .get(jobMatch[1]);
      return job
        ? Response.json(job)
        : Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const refresh = path.match(/^\/api\/projects\/([^/]+)\/refresh$/);
    if (request.method === "POST" && refresh) {
      if (!rate(this.db, "enqueue:" + a.id, 4))
        return Response.json({ error: "RATE_LIMIT" }, { status: 429 });
      if (!license(a).writable)
        return Response.json({ error: "TRIAL_ENDED" }, { status: 402 });
      let data;
      try {
        data = await request.json();
      } catch {
        return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
      }
      if (
        data.keywordID !== undefined &&
        (typeof data.keywordID !== "string" || data.keywordID.length > 100)
      )
        return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
      return this.enqueue(refresh[1], data.keywordID);
    }
    const response = await this.app.handle(request, {
      request,
      ip: identity.ip,
    });
    if (
      request.method === "PATCH" &&
      path === "/api/preferences" &&
      response.ok
    )
      await this.ensureAlarm();
    return response;
  }
  async enqueue(projectID, keywordID) {
    const account = this.db.prepare("SELECT * FROM accounts LIMIT 1").get();
    const project = JSON.parse(account.workspace).projects.find(
      (p) => String(p.id) === projectID,
    );
    if (!project)
      return Response.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    const active = this.db
      .prepare(
        "SELECT * FROM jobs WHERE project_id=? AND status IN ('queued','running') LIMIT 1",
      )
      .get(projectID);
    if (active)
      return Response.json(
        {
          jobId: active.id,
          status: active.status,
          completed: active.completed,
          errors: active.errors,
          total: active.total,
        },
        { status: 202 },
      );
    const words = project.keywords
      .filter((k) => !k.archived && (!keywordID || String(k.id) === keywordID))
      .map((k) => ({
        id: k.id,
        text: k.text,
        appleID: project.appleID,
        country: project.country,
      }));
    if (!words.length) return Response.json({ completed: 0, errors: 0 });
    const id = crypto.randomUUID();
    this.db
      .prepare(
        "INSERT INTO jobs(id,project_id,words,status,total,created) VALUES(?,?,?,?,?,?)",
      )
      .run(
        id,
        projectID,
        JSON.stringify(words),
        "queued",
        words.length,
        Date.now(),
      );
    await this.ctx.storage.setAlarm(Date.now() + 100);
    return Response.json(
      {
        jobId: id,
        status: "queued",
        completed: 0,
        errors: 0,
        total: words.length,
      },
      { status: 202 },
    );
  }
  async ensureAlarm() {
    if ((await this.ctx.storage.getAlarm()) === null)
      await this.ctx.storage.setAlarm(Date.now() + 60000);
  }
  async alarm() {
    const a = this.db.prepare("SELECT * FROM accounts LIMIT 1").get();
    if (!a) return;
    let job = this.db
      .prepare(
        "SELECT * FROM jobs WHERE status IN ('queued','running') ORDER BY created LIMIT 1",
      )
      .get();
    if (job) {
      const words = JSON.parse(job.words),
        word = words[0];
      let completed = 0,
        errors = 0;
      this.db
        .prepare("UPDATE jobs SET status='running' WHERE id=?")
        .run(job.id);
      const p = JSON.parse(a.workspace).projects.find(
          (p) => String(p.id) === job.project_id,
        ),
        k = p?.keywords.find((k) => k.id === word.id);
      if (
        !license(a).writable ||
        !k ||
        k.archived ||
        p.appleID !== word.appleID ||
        p.country !== word.country ||
        k.text !== word.text
      )
        errors = 1;
      else {
        try {
          const request = new Request(
            this.env.PUBLIC_ORIGIN +
              "/api/projects/" +
              job.project_id +
              "/refresh",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ keywordID: String(word.id) }),
            },
          );
          const response = await this.app.handle(request, {
            request,
            ip: "scheduled",
            internalScheduled: true,
          });
          const result = await response.json();
          if (!response.ok) errors = 1;
          else {
            completed = result.completed;
            errors = result.errors;
          }
        } catch {
          errors = 1;
        }
      }
      // Re-read job before writing: imports or account removal may have cancelled it.
      const current = this.db
        .prepare("SELECT id FROM jobs WHERE id=?")
        .get(job.id);
      if (current)
        this.db
          .prepare(
            "UPDATE jobs SET words=?,completed=completed+?,errors=errors+?,status=? WHERE id=?",
          )
          .run(
            JSON.stringify(words.slice(1)),
            completed,
            errors,
            words.length > 1 ? "queued" : "completed",
            job.id,
          );
    }
    const current = this.db.prepare("SELECT * FROM accounts LIMIT 1").get();
    if (!current) return;
    const data = JSON.parse(current.workspace);
    if (
      !job &&
      data.automaticUpdates &&
      license(current).writable &&
      license(current).checksRemaining
    ) {
      outer: for (const p of data.projects.filter((p) => !p.archived))
        for (const k of p.keywords.filter((k) => !k.archived)) {
          if (
            (!latest(k) || Date.now() - Date.parse(latest(k).date) >= DAY) &&
            (!k.lastAttempt || Date.now() - Date.parse(k.lastAttempt) >= 900000)
          ) {
            await this.enqueue(String(p.id), String(k.id));
            break outer;
          }
        }
    }
    this.db
      .prepare("DELETE FROM jobs WHERE created<?")
      .run(Date.now() - 7 * DAY);
    this.db
      .prepare("DELETE FROM cache WHERE created<?")
      .run(Date.now() - 7 * DAY);
    this.db.prepare("DELETE FROM limits WHERE updated<?").run(Date.now() - DAY);
    this.db
      .prepare("DELETE FROM telemetry WHERE day<?")
      .run(new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10));
    const pending = this.db
      .prepare(
        "SELECT id FROM jobs WHERE status IN ('queued','running') LIMIT 1",
      )
      .get();
    if (pending || data.automaticUpdates)
      await this.ctx.storage.setAlarm(Date.now() + (pending ? 1000 : 60000));
  }
  payment(event) {
    return applyPayment(this.db, event);
  }
  trial(event) {
    return applyAppleTrial(this.db, event);
  }
  async deleteAccount() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.db = sqliteAdapter(this.ctx.storage);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS _deleted(value INTEGER NOT NULL); INSERT INTO _deleted VALUES(1)",
    );
  }
}
