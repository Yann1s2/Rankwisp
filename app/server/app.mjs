import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import {
  SignedDataVerifier,
  Environment,
} from "@apple/app-store-server-library";
import { z } from "zod";
import {
  hash,
  accountCreate,
  passwordMatches,
  passwordHash,
  sessionCreate,
  rate,
  transaction,
  saveWorkspace,
  applyPayment,
  applyAppleTrial,
} from "./db.mjs";
import {
  COUNTRIES,
  parseImport,
  normalizeKeywords,
  license,
  latest,
  DAY,
} from "../shared/domain.mjs";
import { appleClient, competitors } from "./apple.mjs";
import { advise } from "./ai.mjs";
const fail = (code, status = 400) => Object.assign(Error(code), { status });
const country = z.enum(COUNTRIES);
export function createApp(
  db,
  {
    env = process.env,
    apple = appleClient(db),
    ai = advise,
    stripeClient,
  } = {},
) {
  const app = express();
  app.disable("x-powered-by");
  const prod = env.NODE_ENV === "production";
  const origin = env.PUBLIC_ORIGIN || "http://127.0.0.1:4318";
  const allowed = new Set([
    origin,
    ...(
      env.ALLOWED_ORIGINS ||
      "http://127.0.0.1:4317,capacitor://localhost,http://localhost,rankwisp://app"
    ).split(","),
  ]);
  const running = new Set();
  if (
    prod &&
    (!origin.startsWith("https://") ||
      !env.INVITE_CODE ||
      env.INVITE_CODE.length < 24)
  )
    throw Error("PRODUCTION_REQUIRES_HTTPS_AND_INVITE");
  const stripe =
    stripeClient ??
    (env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null);
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    if (prod) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.mzstatic.com; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    const o = req.headers.origin;
    if (o && !allowed.has(o))
      return res.status(403).json({ error: "ORIGIN_REJECTED" });
    if (o) {
      res.setHeader("Access-Control-Allow-Origin", o);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization,X-Rankwisp-Client",
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PATCH,DELETE,OPTIONS",
      );
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    if (!rate(db, "ip:" + hash(req.socket.remoteAddress ?? "unknown"), 180))
      return res.status(429).json({ error: "RATE_LIMIT" });
    next();
  });
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      if (!stripe || !env.STRIPE_WEBHOOK_SECRET)
        return res.status(503).json({ error: "PAYMENTS_NOT_CONFIGURED" });
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers["stripe-signature"],
          env.STRIPE_WEBHOOK_SECRET,
        );
      } catch {
        return res.status(400).json({ error: "INVALID_SIGNATURE" });
      }
      try {
        if (
          [
            "checkout.session.completed",
            "checkout.session.async_payment_succeeded",
          ].includes(event.type)
        ) {
          const session = await stripe.checkout.sessions.retrieve(
            event.data.object.id,
            { expand: ["line_items"] },
          );
          if (
            session.payment_status === "paid" &&
            session.mode === "payment" &&
            session.line_items?.data.length === 1 &&
            session.line_items.data[0].price?.id === env.STRIPE_PRICE_ID
          ) {
            const owner = session.client_reference_id;
            applyPayment(db, {
              eventID: event.id,
              paymentID: session.payment_intent,
              account: owner,
              status: "paid",
              provider: "stripe",
            });
          }
        }
        if (
          ["charge.refunded", "charge.dispute.created"].includes(event.type)
        ) {
          const object = event.data.object;
          const paymentID = object.payment_intent;
          const old = db
            .prepare("SELECT * FROM payments WHERE id=?")
            .get(paymentID);
          if (old)
            applyPayment(db, {
              eventID: event.id,
              paymentID,
              account: old.account,
              status: "revoked",
              provider: "stripe",
            });
          else if (paymentID) {
            const sessions = await stripe.checkout.sessions.list({
              payment_intent: paymentID,
              limit: 1,
            });
            const owner = sessions.data[0]?.client_reference_id;
            if (owner)
              applyPayment(db, {
                eventID: event.id,
                paymentID,
                account: owner,
                status: "revoked",
                provider: "stripe",
              });
          }
        }
        res.json({ received: true });
      } catch {
        res.status(503).json({ error: "WEBHOOK_RETRY" });
      }
    },
  );
  app.use(express.json({ limit: "12mb" }));
  app.get("/api/health", (_q, res) =>
    res.json({
      ok: true,
      product: "Rankwisp",
      mode: prod ? "production" : "local-preview",
    }),
  );
  app.get("/api/config", (_q, res) =>
    res.json({
      localPreview: !prod,
      registrationOpen: !prod && !env.INVITE_CODE,
      aiConfigured: !!env.OPENAI_API_KEY,
      paymentsConfigured:
        !!stripe && !!env.STRIPE_PRICE_ID && env.LEGAL_APPROVED === "true",
      applePaymentsConfigured:
        env.LEGAL_APPROVED === "true" &&
        !!env.APPLE_ROOT_CERTS_DIR &&
        !!env.APPLE_APP_ID,
      support: "info@zhstudio.ch",
    }),
  );
  const authInput = z.object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(200),
    invite: z.string().max(200).optional(),
    platform: z.enum(["web", "ios", "desktop"]).default("web"),
  });
  function setSession(req, res, id) {
    const token = sessionCreate(db, id);
    res.cookie("rankwisp", token, {
      httpOnly: true,
      secure: prod,
      sameSite: "strict",
      maxAge: 7 * DAY,
      path: "/api",
    });
    return req.headers["x-rankwisp-client"] === "native" ? { token } : {};
  }
  app.post("/api/auth/register", (req, res) => {
    if (
      !rate(db, "register:" + hash(req.socket.remoteAddress ?? ""), 5, 3600000)
    )
      throw fail("RATE_LIMIT", 429);
    const v = authInput.parse(req.body);
    if (env.INVITE_CODE && v.invite !== env.INVITE_CODE)
      throw fail("INVITE_REQUIRED", 403);
    if (db.prepare("SELECT id FROM accounts WHERE email=?").get(v.email))
      throw fail("ACCOUNT_UNAVAILABLE", 409);
    const a = accountCreate(
      db,
      v.email,
      v.password,
      Date.now(),
      v.platform === "ios",
    );
    res.json({
      ...setSession(req, res, a.id),
      account: { id: a.id, email: a.email },
      license: license(a),
    });
  });
  app.post("/api/auth/login", (req, res) => {
    if (!rate(db, "login:" + hash(req.socket.remoteAddress ?? ""), 10, 900000))
      throw fail("RATE_LIMIT", 429);
    const v = authInput.parse(req.body);
    const a = db.prepare("SELECT * FROM accounts WHERE email=?").get(v.email);
    if (!a) {
      passwordHash(v.password);
      throw fail("INVALID_LOGIN", 401);
    }
    if (!passwordMatches(v.password, a.password))
      throw fail("INVALID_LOGIN", 401);
    res.json({
      ...setSession(req, res, a.id),
      account: { id: a.id, email: a.email },
      license: license(a),
    });
  });
  app.post("/api/webhooks/apple", async (req, res) => {
    try {
      const notification = await appleVerifier().verifyAndDecodeNotification(
        z.string().max(50000).parse(req.body.signedPayload),
      );
      const signed = notification.data?.signedTransactionInfo;
      if (signed) {
        const tx = await appleVerifier().verifyAndDecodeTransaction(signed);
        if (
          tx.productId ===
            (env.APPLE_PRODUCT_ID || "ch.zhstudio.rankwisp.lifetime") &&
          tx.appAccountToken &&
          tx.originalTransactionId
        ) {
          const account = db
            .prepare("SELECT id FROM accounts WHERE id=?")
            .get(tx.appAccountToken.toLowerCase());
          if (account)
            applyPayment(db, {
              eventID: "apple-notification:" + notification.notificationUUID,
              paymentID: "apple:" + tx.originalTransactionId,
              account: account.id,
              status: tx.revocationDate ? "revoked" : "paid",
              provider: "apple",
            });
        }
      }
      res.json({ received: true });
    } catch {
      res.status(400).json({ error: "INVALID_SIGNATURE" });
    }
  });
  app.use("/api", (req, _res, next) => {
    const token =
      req.headers.authorization?.replace(/^Bearer /, "") ??
      req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("rankwisp="))
        ?.slice(9);
    const a = token
      ? db
          .prepare(
            "SELECT a.* FROM accounts a JOIN sessions s ON s.account=a.id WHERE s.token=? AND s.expires>?",
          )
          .get(hash(token), Date.now())
      : null;
    if (!a) return next(fail("SIGN_IN_REQUIRED", 401));
    req.account = a;
    req.token = token;
    next();
  });
  const writable = (req) => {
    if (!license(req.account).writable) throw fail("TRIAL_ENDED", 402);
  };
  const ws = (req) =>
    JSON.parse(
      db
        .prepare("SELECT workspace FROM accounts WHERE id=?")
        .get(req.account.id).workspace,
    );
  const getProject = (data, id) => {
    const p = data.projects.find((p) => String(p.id) === id);
    if (!p) throw fail("PROJECT_NOT_FOUND", 404);
    return p;
  };
  app.get("/api/me", (req, res) =>
    res.json({
      account: { id: req.account.id, email: req.account.email },
      license: license(req.account),
      aiConsent: !!req.account.ai_consent,
      telemetry: !!req.account.telemetry,
      serverTime: new Date().toISOString(),
    }),
  );
  app.post("/api/auth/logout", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(hash(req.token));
    res.clearCookie("rankwisp", { path: "/api" });
    res.json({ ok: true });
  });
  app.post("/api/auth/password", (req, res) => {
    const v = z
      .object({
        current: z.string().max(200),
        password: z.string().min(12).max(200),
      })
      .parse(req.body);
    if (!passwordMatches(v.current, req.account.password))
      throw fail("INVALID_LOGIN", 401);
    transaction(db, () => {
      db.prepare("UPDATE accounts SET password=? WHERE id=?").run(
        passwordHash(v.password),
        req.account.id,
      );
      db.prepare("DELETE FROM sessions WHERE account=?").run(req.account.id);
    });
    res.json({ ...setSession(req, res, req.account.id), ok: true });
  });
  app.get("/api/workspace", (req, res) => {
    const data = ws(req);
    res.json({ workspace: data, revision: hash(JSON.stringify(data)) });
  });
  app.get("/api/export", (req, res) => {
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="rankwisp-export.json"',
    );
    res.json(ws(req));
  });
  app.get("/api/imports", (req, res) =>
    res.json(
      db
        .prepare(
          "SELECT id,created FROM imports WHERE account=? ORDER BY created DESC",
        )
        .all(req.account.id),
    ),
  );
  app.get("/api/imports/:id", (req, res) => {
    const row = db
      .prepare("SELECT original,previous FROM imports WHERE account=? AND id=?")
      .get(req.account.id, req.params.id);
    if (!row) throw fail("NOT_FOUND", 404);
    res.json({
      original: JSON.parse(row.original),
      previous: JSON.parse(row.previous),
    });
  });
  app.post("/api/import/preview", (req, res) =>
    res.json(parseImport(req.body).summary),
  );
  app.post("/api/import", (req, res) => {
    const { data, summary } = parseImport(req.body.data);
    const current = ws(req);
    if (req.body.revision !== hash(JSON.stringify(current)))
      throw fail("IMPORT_CONFLICT", 409);
    transaction(db, () => {
      db.prepare("INSERT INTO imports VALUES(?,?,?,?,?)").run(
        randomUUID(),
        req.account.id,
        Date.now(),
        JSON.stringify(req.body.data),
        JSON.stringify(current),
      );
      saveWorkspace(db, req.account.id, { ...data, automaticUpdates: false });
    });
    res.json({ summary, workspace: ws(req) });
  });
  app.patch("/api/preferences", (req, res) => {
    const v = z
      .object({
        aiConsent: z.boolean().optional(),
        telemetry: z.boolean().optional(),
        automaticUpdates: z.boolean().optional(),
      })
      .parse(req.body);
    if (v.aiConsent !== undefined)
      db.prepare("UPDATE accounts SET ai_consent=? WHERE id=?").run(
        Number(v.aiConsent),
        req.account.id,
      );
    if (v.telemetry !== undefined)
      db.prepare("UPDATE accounts SET telemetry=? WHERE id=?").run(
        Number(v.telemetry),
        req.account.id,
      );
    if (v.automaticUpdates !== undefined) {
      writable(req);
      const data = ws(req);
      data.automaticUpdates = v.automaticUpdates;
      saveWorkspace(db, req.account.id, data);
    }
    res.json({ ok: true });
  });
  app.post("/api/telemetry", (req, res) => {
    const v = z
      .object({
        surface: z.enum(["app", "website"]),
        event: z.enum([
          "onboarding_complete",
          "refresh_complete",
          "export",
          "page_view",
        ]),
      })
      .parse(req.body);
    if (req.account.telemetry)
      db.prepare(
        "INSERT INTO telemetry VALUES(?,?,?,1) ON CONFLICT(day,surface,event) DO UPDATE SET count=count+1",
      ).run(new Date().toISOString().slice(0, 10), v.surface, v.event);
    res.json({ ok: true });
  });
  app.delete("/api/account", (req, res) => {
    if (!passwordMatches(String(req.body.password ?? ""), req.account.password))
      throw fail("INVALID_LOGIN", 401);
    transaction(db, () => {
      db.prepare("DELETE FROM cache WHERE key LIKE ?").run(
        "ai:" + req.account.id + ":%",
      );
      db.prepare("DELETE FROM accounts WHERE id=?").run(req.account.id);
    });
    res.clearCookie("rankwisp", { path: "/api" });
    res.json({ ok: true });
  });
  app.get("/api/search", async (req, res) => {
    writable(req);
    if (!rate(db, "search:" + req.account.id, 12))
      throw fail("RATE_LIMIT", 429);
    const c = country.parse(req.query.country);
    const q = z.string().min(1).max(300).parse(req.query.q);
    res.json(await apple.search(q, c));
  });
  app.get("/api/competitors", async (req, res) => {
    writable(req);
    if (!rate(db, "competitors:" + req.account.id, 6))
      throw fail("RATE_LIMIT", 429);
    const c = country.parse(req.query.country);
    const id = z
      .string()
      .regex(/^\d{5,15}$/)
      .parse(req.query.id);
    const term = z.string().min(2).max(100).parse(req.query.term);
    const own = (await apple.request({ id, country: c })).results[0];
    if (!own) throw fail("APP_NOT_FOUND", 404);
    const found = await apple.search(term, c);
    res.json({
      results: competitors(own, found.results, term),
      fetchedAt: found.fetchedAt,
    });
  });
  app.post("/api/projects", async (req, res) => {
    writable(req);
    const v = z
      .object({
        appleID: z.number().int().positive(),
        country,
        competitorIDs: z.array(z.number().int().positive()).max(5),
        keywords: z.string().max(3000),
      })
      .parse(req.body);
    const own = (await apple.request({ id: v.appleID, country: v.country }))
      .results[0];
    if (!own) throw fail("APP_NOT_FOUND", 404);
    let rivals = [];
    if (v.competitorIDs.length)
      rivals = (
        await apple.request({
          id: [...new Set(v.competitorIDs.filter((x) => x !== v.appleID))].join(
            ",",
          ),
          country: v.country,
        })
      ).results;
    const data = ws(req);
    if (data.projects.length >= 10) throw fail("PROJECT_LIMIT");
    if (
      data.projects.some(
        (p) => p.appleID === v.appleID && p.country === v.country,
      )
    )
      throw fail("PROJECT_EXISTS");
    const words = normalizeKeywords(v.keywords);
    if (words.length > 50 || words.some((w) => w.length > 100))
      throw fail("KEYWORD_LIMIT");
    const p = {
      id: randomUUID(),
      appleID: v.appleID,
      name: own.name,
      country: v.country,
      metadata: own,
      archived: false,
      competitors: rivals,
      storeSnapshots: [],
      keywords: words.map((text) => ({
        id: randomUUID(),
        text,
        category: "unclassified",
        samples: [],
        archived: false,
      })),
    };
    data.projects.push(p);
    saveWorkspace(db, req.account.id, data);
    res.json(p);
  });
  app.post("/api/projects/:id/keywords", (req, res) => {
    writable(req);
    const text = z.string().min(1).max(3000).parse(req.body.text);
    const words = normalizeKeywords(text);
    const data = ws(req);
    const p = getProject(data, req.params.id);
    const added = words.filter((w) => !p.keywords.some((k) => k.text === w));
    const restored = p.keywords.filter(
      (k) => k.archived && words.includes(k.text),
    );
    if (
      p.keywords.filter((k) => !k.archived).length +
        added.length +
        restored.length >
        50 ||
      words.some((w) => w.length > 100)
    )
      throw fail("KEYWORD_LIMIT");
    restored.forEach((k) => (k.archived = false));
    p.keywords.push(
      ...added.map((text) => ({
        id: randomUUID(),
        text,
        category: "unclassified",
        samples: [],
        archived: false,
      })),
    );
    saveWorkspace(db, req.account.id, data);
    res.json({ ok: true });
  });
  app.patch("/api/projects/:id/keywords/:keyword", (req, res) => {
    writable(req);
    const v = z
      .object({
        archived: z.boolean().optional(),
        category: z
          .enum(["core", "brand", "adjacent", "unclassified"])
          .optional(),
      })
      .parse(req.body);
    const data = ws(req);
    const p = getProject(data, req.params.id);
    const k = p.keywords.find((k) => String(k.id) === req.params.keyword);
    if (!k) throw fail("KEYWORD_NOT_FOUND", 404);
    if (
      v.archived === false &&
      k.archived &&
      p.keywords.filter((x) => !x.archived).length >= 50
    )
      throw fail("KEYWORD_LIMIT");
    Object.assign(k, v);
    saveWorkspace(db, req.account.id, data);
    res.json({ ok: true });
  });
  app.patch("/api/projects/:id/competitors", async (req, res) => {
    writable(req);
    const ids = z.array(z.number().int().positive()).max(5).parse(req.body.ids);
    const before = getProject(ws(req), req.params.id);
    const rivals = ids.length
      ? (
          await apple.request({
            id: [...new Set(ids.filter((i) => i !== before.appleID))].join(","),
            country: before.country,
          })
        ).results
      : [];
    const data = ws(req);
    getProject(data, req.params.id).competitors = rivals;
    saveWorkspace(db, req.account.id, data);
    res.json({ ok: true });
  });
  async function refresh(
    accountID,
    projectID,
    keywordID,
    { dueOnly = false } = {},
  ) {
    const lock = accountID + ":" + projectID;
    if (running.has(lock)) throw fail("REFRESH_RUNNING", 409);
    running.add(lock);
    let completed = 0,
      errors = 0;
    try {
      let a = db.prepare("SELECT * FROM accounts WHERE id=?").get(accountID);
      if (!license(a).writable) throw fail("TRIAL_ENDED", 402);
      const project = getProject(JSON.parse(a.workspace), projectID);
      const words = project.keywords.filter(
        (k) =>
          !k.archived &&
          (!keywordID || String(k.id) === keywordID) &&
          (!dueOnly ||
            ((!latest(k) || Date.now() - Date.parse(latest(k).date) >= DAY) &&
              (!k.lastError ||
                !k.lastAttempt ||
                Date.now() - Date.parse(k.lastAttempt) >= 900000))),
      );
      for (const keyword of words) {
        a = db.prepare("SELECT * FROM accounts WHERE id=?").get(accountID);
        if (!a || !license(a).writable) break;
        const reserved = transaction(db, () => {
          const current = db
            .prepare("SELECT * FROM accounts WHERE id=?")
            .get(accountID);
          if (!license(current).checksRemaining) return false;
          db.prepare("UPDATE accounts SET checks=checks+1 WHERE id=?").run(
            accountID,
          );
          return true;
        });
        if (!reserved) break;
        let result, error;
        try {
          result = await apple.request(
            { term: keyword.text, country: project.country },
            { fresh: true },
          );
        } catch (e) {
          error = ["APPLE_RATE_LIMIT", "APPLE_INVALID_RESPONSE"].includes(
            e.message,
          )
            ? e.message
            : "APPLE_UNAVAILABLE";
        }
        a = db.prepare("SELECT * FROM accounts WHERE id=?").get(accountID);
        if (!a) break;
        const data = JSON.parse(a.workspace);
        const p = data.projects.find((p) => String(p.id) === projectID);
        const k = p?.keywords.find((k) => k.id === keyword.id);
        if (!k) continue;
        k.lastAttempt = new Date().toISOString();
        if (error) {
          k.lastError = error;
          errors++;
        } else {
          delete k.lastError;
          const results = result.results.map((a) => ({
            id: a.id,
            name: a.name,
          }));
          const n = results.findIndex((a) => a.id === project.appleID);
          k.samples.push({
            id: randomUUID(),
            date: result.fetchedAt,
            rank: n < 0 ? null : n + 1,
            resultCount: results.length,
            results,
            source: "apple-search-v1",
            ...(result.httpDate ? { httpDate: result.httpDate } : {}),
            ...(result.cacheAge ? { cacheAge: result.cacheAge } : {}),
          });
          completed++;
        }
        saveWorkspace(db, accountID, data);
      }
      return { completed, errors };
    } finally {
      running.delete(lock);
    }
  }
  app.post("/api/projects/:id/refresh", async (req, res) => {
    writable(req);
    if (!rate(db, "refresh:" + req.account.id, 4))
      throw fail("RATE_LIMIT", 429);
    res.json(await refresh(req.account.id, req.params.id, req.body.keywordID));
  });
  app.post("/api/projects/:id/metadata", async (req, res) => {
    writable(req);
    const p = getProject(ws(req), req.params.id);
    try {
      const result = await apple.request(
        {
          id: [p.appleID, ...(p.competitors ?? []).map((a) => a.id)].join(","),
          country: p.country,
        },
        { fresh: true },
      );
      const data = ws(req);
      const current = getProject(data, req.params.id);
      current.lastMetadataAttempt = result.fetchedAt;
      delete current.lastMetadataError;
      current.metadata =
        result.results.find((a) => a.id === p.appleID) ?? current.metadata;
      current.storeSnapshots = [
        ...(current.storeSnapshots ?? []),
        ...result.results,
      ];
      saveWorkspace(db, req.account.id, data);
      res.json({ ok: true });
    } catch {
      const data = ws(req);
      const current = getProject(data, req.params.id);
      current.lastMetadataAttempt = new Date().toISOString();
      current.lastMetadataError = "APPLE_UNAVAILABLE";
      saveWorkspace(db, req.account.id, data);
      throw fail("APPLE_UNAVAILABLE", 503);
    }
  });
  app.post("/api/projects/:id/advice", async (req, res) => {
    writable(req);
    if (!rate(db, "ai:" + req.account.id, 4)) throw fail("RATE_LIMIT", 429);
    const v = z
      .object({
        locale: z.enum(["en", "de"]),
        kind: z.enum(["next", "weekly", "competitors", "creative"]),
        decision: z.boolean().default(false),
      })
      .parse(req.body);
    res.json(
      await ai(db, req.account, getProject(ws(req), req.params.id), {
        ...v,
        env,
      }),
    );
  });
  app.post("/api/billing/checkout", async (req, res) => {
    if (!stripe || !env.STRIPE_PRICE_ID || env.LEGAL_APPROVED !== "true")
      throw fail("PAYMENTS_NOT_CONFIGURED", 503);
    if (req.account.license === "paid") throw fail("ALREADY_PAID");
    if (req.body.acceptTerms !== true) throw fail("TERMS_REQUIRED");
    if (!rate(db, "checkout:" + req.account.id, 3))
      throw fail("RATE_LIMIT", 429);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: req.account.id,
      customer_email: req.account.email,
      success_url: origin + "/app?payment=success",
      cancel_url: origin + "/app?payment=cancelled",
      automatic_tax: { enabled: true },
      consent_collection: { terms_of_service: "required" },
      metadata: { termsVersion: "2026-11-17" },
    });
    res.json({ url: session.url });
  });
  let verifier;
  function appleVerifier() {
    if (verifier) return verifier;
    if (!env.APPLE_ROOT_CERTS_DIR || !env.APPLE_BUNDLE_ID)
      throw fail("PAYMENTS_NOT_CONFIGURED", 503);
    const roots = readdirSync(env.APPLE_ROOT_CERTS_DIR)
      .filter((n) => n.endsWith(".cer"))
      .map((n) => readFileSync(resolve(env.APPLE_ROOT_CERTS_DIR, n)));
    if (!roots.length) throw fail("PAYMENTS_NOT_CONFIGURED", 503);
    verifier = new SignedDataVerifier(
      roots,
      true,
      env.APPLE_ENVIRONMENT === "Production"
        ? Environment.PRODUCTION
        : Environment.SANDBOX,
      env.APPLE_BUNDLE_ID,
      env.APPLE_APP_ID ? Number(env.APPLE_APP_ID) : undefined,
    );
    return verifier;
  }
  app.post("/api/billing/apple", async (req, res) => {
    const signed = z.string().max(20000).parse(req.body.signedTransaction);
    const tx = await appleVerifier().verifyAndDecodeTransaction(signed);
    if (
      tx.productId ===
      (env.APPLE_TRIAL_PRODUCT_ID || "ch.zhstudio.rankwisp.trial24")
    ) {
      if (
        tx.appAccountToken?.toLowerCase() !== req.account.id.toLowerCase() ||
        !tx.originalTransactionId
      )
        throw fail("INVALID_PURCHASE", 403);
      applyAppleTrial(db, {
        transactionID: tx.originalTransactionId,
        account: req.account.id,
        purchaseDate: tx.purchaseDate,
        revoked: !!tx.revocationDate,
      });
      return res.json({
        license: license(
          db.prepare("SELECT * FROM accounts WHERE id=?").get(req.account.id),
        ),
      });
    }
    if (
      tx.productId !==
        (env.APPLE_PRODUCT_ID || "ch.zhstudio.rankwisp.lifetime") ||
      tx.appAccountToken?.toLowerCase() !== req.account.id.toLowerCase() ||
      !tx.originalTransactionId
    )
      throw fail("INVALID_PURCHASE", 403);
    applyPayment(db, {
      eventID: "apple:" + hash(signed),
      paymentID: "apple:" + tx.originalTransactionId,
      account: req.account.id,
      status: tx.revocationDate ? "revoked" : "paid",
      provider: "apple",
    });
    res.json({
      license: license(
        db.prepare("SELECT * FROM accounts WHERE id=?").get(req.account.id),
      ),
    });
  });
  app.post("/api/billing/restore", (req, res) =>
    res.json({ license: license(req.account) }),
  );
  app.use("/api", (_q, _r, next) => next(fail("NOT_FOUND", 404)));
  app.use((e, _req, res, _next) => {
    const validation = e instanceof z.ZodError;
    const known = /^[A-Z_]+$/.test(e.message);
    res
      .status(validation ? 400 : e.status || 502)
      .json({
        error: validation
          ? "INVALID_INPUT"
          : known
            ? e.message
            : "SERVICE_UNAVAILABLE",
      });
  });
  let scheduling = false;
  app.locals.tick = async () => {
    if (scheduling) return;
    scheduling = true;
    try {
      const accounts = db.prepare("SELECT id,workspace FROM accounts").all();
      for (const a of accounts) {
        const data = JSON.parse(a.workspace);
        if (data.automaticUpdates)
          for (const p of data.projects.filter((p) => !p.archived)) {
            try {
              await refresh(a.id, String(p.id), undefined, { dueOnly: true });
            } catch {
              /* errors recorded in workspace; no sensitive logging */
            }
          }
      }
      db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      db.prepare("DELETE FROM cache WHERE created<?").run(Date.now() - 7 * DAY);
      db.prepare("DELETE FROM telemetry WHERE day<?").run(
        new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10),
      );
      db.prepare("DELETE FROM limits WHERE updated<?").run(Date.now() - DAY);
    } finally {
      scheduling = false;
    }
  };
  return app;
}
