import { DurableObject } from "cloudflare:workers";
import { sqliteAdapter } from "./sqlite.mjs";
import { appleClient } from "../server/apple.mjs";
import { z } from "zod";
import { COUNTRIES } from "../shared/domain.mjs";
export class ServiceCoordinator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.db = sqliteAdapter(ctx.storage);
    this.apple = appleClient(this.db);
  }
  async appleRequest(params, options = {}) {
    const input = z
      .object({
        id: z
          .union([
            z
              .string()
              .regex(/^\d+(,\d+)*$/)
              .max(200),
            z.number().int().positive(),
          ])
          .optional(),
        term: z.string().min(1).max(300).optional(),
        country: z.enum(COUNTRIES),
      })
      .refine((x) => Boolean(x.id) !== Boolean(x.term))
      .parse(params);
    return this.apple.request(input, { fresh: options.fresh === true });
  }
  reserveAI(amount) {
    const cap = Number(this.env.AI_GLOBAL_BUDGET_USD || 20);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1 ||
      !Number.isFinite(cap) ||
      cap <= 0
    )
      return false;
    return this.ctx.storage.transactionSync(() => {
      const old =
        this.db
          .prepare("SELECT value FROM counters WHERE key='global-ai-spend'")
          .get()?.value || 0;
      if (old + amount > cap) return false;
      this.db
        .prepare(
          "INSERT INTO counters VALUES('global-ai-spend',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(old + amount);
      return true;
    });
  }
  cleanup() {
    this.db
      .prepare("DELETE FROM cache WHERE created<?")
      .run(Date.now() - 7 * 86400000);
  }
}
