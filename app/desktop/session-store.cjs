const { dirname } = require("node:path");
const {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  mkdirSync,
} = require("node:fs");
const validToken = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

// Serializing writes prevents logout from racing a pending Keychain permission prompt.
function createSessionStore(safeStorage, file, deadlineMs = 60000) {
  let queue = Promise.resolve();
  const serialize = (task) => {
    const next = queue.then(task);
    queue = next.catch(() => {});
    return next;
  };
  async function encryptAndWrite(value, expires) {
    if (!(await safeStorage.isAsyncEncryptionAvailable()))
      throw Error("SECURE_STORAGE_UNAVAILABLE");
    const encrypted = await safeStorage.encryptStringAsync(value);
    if (Date.now() > expires) throw Error("SECURE_STORAGE_UNAVAILABLE");
    const temporary = file + ".tmp";
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    try {
      writeFileSync(temporary, encrypted, { mode: 0o600 });
      renameSync(temporary, file);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }
  return {
    get: () =>
      serialize(async () => {
        if (!existsSync(file)) return "";
        const expires = Date.now() + deadlineMs;
        if (!(await safeStorage.isAsyncEncryptionAvailable()))
          throw Error("SECURE_STORAGE_UNAVAILABLE");
        const value = await safeStorage.decryptStringAsync(readFileSync(file));
        if (!validToken(value.result))
          throw Error("SECURE_STORAGE_UNAVAILABLE");
        if (value.shouldReEncrypt) await encryptAndWrite(value.result, expires);
        return value.result;
      }),
    set: (value) =>
      serialize(async () => {
        if (value === "") {
          rmSync(file, { force: true });
          return;
        }
        if (!validToken(value)) throw Error("INVALID_SESSION");
        await encryptAndWrite(value, Date.now() + deadlineMs);
      }),
  };
}
module.exports = { createSessionStore };
