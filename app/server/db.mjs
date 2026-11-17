import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { emptyWorkspace } from "../shared/domain.mjs";
export * from "./db-core.mjs";
export function openDB(path) {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  }
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created INTEGER NOT NULL,license TEXT NOT NULL DEFAULT 'trial',checks INTEGER NOT NULL DEFAULT 0,ai_count INTEGER NOT NULL DEFAULT 0,ai_spent REAL NOT NULL DEFAULT 0,ai_consent INTEGER NOT NULL DEFAULT 0,telemetry INTEGER NOT NULL DEFAULT 0,workspace TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,created INTEGER NOT NULL,original TEXT NOT NULL,previous TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS apple_trials(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,started INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY,account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,status TEXT NOT NULL,provider TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,created INTEGER NOT NULL,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,window INTEGER NOT NULL,count INTEGER NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS counters(key TEXT PRIMARY KEY,value REAL NOT NULL);
 CREATE TABLE IF NOT EXISTS telemetry(day TEXT NOT NULL,surface TEXT NOT NULL,event TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(day,surface,event));
 `);
  if (
    !db
      .prepare("PRAGMA table_info(limits)")
      .all()
      .some((c) => c.name === "updated")
  )
    db.exec("ALTER TABLE limits ADD COLUMN updated INTEGER NOT NULL DEFAULT 0");
  if (
    !db
      .prepare("PRAGMA table_info(accounts)")
      .all()
      .some((c) => c.name === "trial_started")
  ) {
    db.exec("ALTER TABLE accounts ADD COLUMN trial_started INTEGER");
    db.exec("UPDATE accounts SET trial_started=created");
  }
  return db;
}
