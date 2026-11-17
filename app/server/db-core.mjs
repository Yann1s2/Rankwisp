import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { emptyWorkspace } from "../shared/domain.mjs";
export const hash = (s) => createHash("sha256").update(s).digest("hex");
export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function passwordMatches(password, encoded) {
  const [salt, key] = encoded.split(":");
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}
export function accountCreate(
  db,
  email,
  password,
  now = Date.now(),
  appleTrial = false,
) {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO accounts(id,email,password,created,workspace,trial_started) VALUES(?,?,?,?,?,?)",
  ).run(
    id,
    email,
    passwordHash(password),
    now,
    JSON.stringify(emptyWorkspace()),
    appleTrial ? null : now,
  );
  return db.prepare("SELECT * FROM accounts WHERE id=?").get(id);
}
export function sessionCreate(db, id) {
  const raw = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    hash(raw),
    id,
    Date.now() + 7 * 86400000,
  );
  return raw;
}
export function rate(db, key, max, period = 60000) {
  const window = Math.floor(Date.now() / period);
  db.prepare(
    "INSERT INTO limits VALUES(?,?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window,updated=excluded.updated",
  ).run(key, window, Date.now());
  return (
    db.prepare("SELECT count FROM limits WHERE key=?").get(key).count <= max
  );
}
export function transaction(db, fn) {
  if (db.transactionSync) return db.transactionSync(fn);
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function saveWorkspace(db, account, data) {
  db.prepare("UPDATE accounts SET workspace=? WHERE id=?").run(
    JSON.stringify(data),
    account,
  );
}
export function applyPayment(
  db,
  { eventID, paymentID, account, status, provider, disputeResolved = false },
) {
  return transaction(db, () => {
    if (db.prepare("SELECT id FROM events WHERE id=?").get(eventID))
      return false;
    if (!db.prepare("SELECT id FROM accounts WHERE id=?").get(account))
      throw Error("ACCOUNT_NOT_FOUND");
    const old = db.prepare("SELECT * FROM payments WHERE id=?").get(paymentID);
    if (old && old.account !== account) throw Error("PAYMENT_OWNERSHIP");
    // Revocation is terminal; delayed success must never resurrect a refund.
    const effective =
      old?.status === "revoked"
        ? "revoked"
        : old?.status === "disputed" && status === "paid" && !disputeResolved
          ? "disputed"
          : status;
    db.prepare(
      "INSERT INTO payments VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status",
    ).run(paymentID, account, effective, provider);
    const paid = db
      .prepare(
        "SELECT id FROM payments WHERE account=? AND status='paid' LIMIT 1",
      )
      .get(account);
    db.prepare("UPDATE accounts SET license=? WHERE id=?").run(
      paid ? "paid" : "trial",
      account,
    );
    db.prepare("INSERT INTO events VALUES(?,?)").run(eventID, Date.now());
    return true;
  });
}

export function applyAppleTrial(
  db,
  { transactionID, account, purchaseDate, revoked = false },
) {
  return transaction(db, () => {
    const existing = db
      .prepare("SELECT * FROM apple_trials WHERE id=?")
      .get(transactionID);
    if (existing && existing.account !== account)
      throw Error("PAYMENT_OWNERSHIP");
    if (!Number.isFinite(purchaseDate) || purchaseDate > Date.now() + 300000)
      throw Error("INVALID_PURCHASE");
    const a = db.prepare("SELECT * FROM accounts WHERE id=?").get(account);
    if (!a) throw Error("ACCOUNT_NOT_FOUND");
    if (!existing)
      db.prepare("INSERT INTO apple_trials VALUES(?,?,?)").run(
        transactionID,
        account,
        purchaseDate,
      );
    if (revoked)
      db.prepare("UPDATE accounts SET trial_started=0 WHERE id=?").run(account);
    else if (a.trial_started === null)
      db.prepare("UPDATE accounts SET trial_started=? WHERE id=?").run(
        purchaseDate,
        account,
      );
    return true;
  });
}
