import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const { createSessionStore } = createRequire(import.meta.url)(
  "../desktop/session-store.cjs",
);
const token = "s".repeat(43);
test("logout queued during OS key prompt cannot leave a late session on disk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rankwisp-session-")),
    file = join(dir, "session.enc");
  let release;
  const prompt = new Promise((r) => (release = r));
  const safe = {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async () => {
      await prompt;
      return Buffer.from("encrypted");
    },
  };
  try {
    const store = createSessionStore(safe, file);
    const write = store.set(token),
      logout = store.set("");
    release();
    await Promise.all([write, logout]);
    assert.equal(existsSync(file), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("OS key rotation rewrites encrypted storage and locked keychain fails without plaintext fallback", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rankwisp-session-")),
    file = join(dir, "nested/session.enc");
  const safe = {
    isAsyncEncryptionAvailable: async () => true,
    encryptStringAsync: async () => Buffer.from("ciphertext-v2"),
    decryptStringAsync: async () => ({ result: token, shouldReEncrypt: true }),
  };
  try {
    const store = createSessionStore(safe, file);
    await store.set(token);
    assert.equal(await store.get(), token);
    assert.equal(readFileSync(file, "utf8"), "ciphertext-v2");
    safe.isAsyncEncryptionAvailable = async () => false;
    await assert.rejects(store.set(token), /SECURE_STORAGE_UNAVAILABLE/);
    assert.equal(readFileSync(file, "utf8"), "ciphertext-v2");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
