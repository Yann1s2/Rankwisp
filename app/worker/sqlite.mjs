import schema from "./account-schema.sql";
const marker = "@rankwisp:chunks:v1";
const MAX_WORKSPACE_BYTES = 16 * 1024 * 1024;
/** Keeps the existing synchronous repository API while storing large JSON across bounded SQL rows. */
export function sqliteAdapter(storage) {
  storage.sql.exec(schema);
  storage.sql.exec(
    "CREATE TABLE IF NOT EXISTS blob_chunks(owner TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL,key TEXT NOT NULL,part INTEGER NOT NULL,value TEXT NOT NULL,PRIMARY KEY(kind,key,part))",
  );
  let depth = 0;
  const atomic = (fn) => {
    if (depth) return fn();
    return storage.transactionSync(() => {
      depth++;
      try {
        return fn();
      } finally {
        depth--;
      }
    });
  };
  const owner = () =>
    storage.sql.exec("SELECT id FROM accounts LIMIT 1").toArray()[0]?.id;
  function writeBlob(account, kind, key, value) {
    if (new TextEncoder().encode(value).byteLength > MAX_WORKSPACE_BYTES)
      throw Object.assign(Error("WORKSPACE_STORAGE_LIMIT"), { status: 413 });
    storage.sql.exec(
      "DELETE FROM blob_chunks WHERE kind=? AND key=?",
      kind,
      key,
    );
    // Never split a surrogate pair: SQLite stores each chunk as valid UTF-8.
    for (let offset = 0, part = 0; offset < value.length; part++) {
      let end = Math.min(offset + 200000, value.length);
      const last = value.charCodeAt(end - 1);
      if (end < value.length && last >= 0xd800 && last <= 0xdbff) end--;
      storage.sql.exec(
        "INSERT INTO blob_chunks VALUES(?,?,?,?,?)",
        account,
        kind,
        key,
        part,
        value.slice(offset, end),
      );
      offset = end;
    }
  }
  const readBlob = (kind, key) =>
    storage.sql
      .exec(
        "SELECT value FROM blob_chunks WHERE kind=? AND key=? ORDER BY part",
        kind,
        key,
      )
      .toArray()
      .map((row) => row.value)
      .join("");
  function hydrate(rows, sql, args) {
    return rows.map((row) => {
      if (row.workspace === marker)
        row.workspace = readBlob("workspace", row.id || owner());
      if (row.original === marker)
        row.original = readBlob("import-original", row.id || args.at(-1));
      if (row.previous === marker)
        row.previous = readBlob("import-previous", row.id || args.at(-1));
      return row;
    });
  }
  function run(sql, args) {
    const compact = sql.replace(/\s+/g, " ").trim();
    if (/^UPDATE accounts SET workspace=\? WHERE id=\?/i.test(compact))
      return atomic(() => {
        writeBlob(args[1], "workspace", args[1], args[0]);
        const c = storage.sql.exec(sql, marker, args[1]);
        return { changes: c.rowsWritten };
      });
    if (/^INSERT INTO accounts\(/i.test(compact)) {
      const columns = compact
        .match(/^INSERT INTO accounts\(([^)]+)\)/i)[1]
        .split(",")
        .map((s) => s.trim());
      const index = columns.indexOf("workspace");
      if (index >= 0)
        return atomic(() => {
          const a = [...args],
            value = a[index];
          a[index] = marker;
          const c = storage.sql.exec(sql, ...a);
          writeBlob(
            a[columns.indexOf("id")],
            "workspace",
            a[columns.indexOf("id")],
            value,
          );
          return { changes: c.rowsWritten };
        });
    }
    if (/^INSERT INTO imports VALUES/i.test(compact))
      return atomic(() => {
        const [id, account, created, original, previous] = args;
        const c = storage.sql.exec(sql, id, account, created, marker, marker);
        writeBlob(account, "import-original", id, original);
        writeBlob(account, "import-previous", id, previous);
        return { changes: c.rowsWritten };
      });
    const c = storage.sql.exec(sql, ...args);
    return { changes: c.rowsWritten };
  }
  return {
    exec: (sql) => storage.sql.exec(sql),
    prepare(sql) {
      return {
        get: (...args) =>
          hydrate(storage.sql.exec(sql, ...args).toArray(), sql, args)[0],
        all: (...args) =>
          hydrate(storage.sql.exec(sql, ...args).toArray(), sql, args),
        run: (...args) => run(sql, args),
      };
    },
    transactionSync: atomic,
  };
}
