/** Minimal Request/Response adapter for the shared API handlers; no Node HTTP server. */
export function requestRouter() {
  const layers = [];
  const app = {
    locals: {},
    disable() {},
    use(...args) {
      const path = typeof args[0] === "string" ? args.shift() : "";
      for (const fn of args) layers.push({ path, fn, middleware: true });
    },
  };
  for (const method of ["get", "post", "patch", "delete"])
    app[method] = (path, ...fns) => {
      for (const fn of fns)
        layers.push({ path, fn, method: method.toUpperCase() });
    };
  app.handle = async (request, context = {}) => {
    const url = new URL(request.url),
      headers = new Headers();
    let status = 200,
      result;
    const req = {
      method: request.method,
      headers: Object.fromEntries(request.headers),
      query: Object.fromEntries(url.searchParams),
      params: {},
      socket: { remoteAddress: context.ip || "internal" },
      ...context,
    };
    const res = {
      setHeader(k, v) {
        headers.set(k, String(v));
        return res;
      },
      status(v) {
        status = v;
        return res;
      },
      json(v) {
        headers.set("Content-Type", "application/json");
        result = JSON.stringify(v);
        return res;
      },
      sendStatus(v) {
        status = v;
        result = "";
        return res;
      },
      cookie(name, value, opts = {}) {
        headers.append(
          "Set-Cookie",
          `${name}=${value}; Path=${opts.path || "/"}; HttpOnly; SameSite=Strict${opts.secure ? "; Secure" : ""}${opts.maxAge ? "; Max-Age=" + Math.floor(opts.maxAge / 1000) : ""}`,
        );
        return res;
      },
      clearCookie(name, opts = {}) {
        headers.append(
          "Set-Cookie",
          `${name}=; Path=${opts.path || "/"}; HttpOnly; SameSite=Strict; Max-Age=0`,
        );
        return res;
      },
    };
    let error;
    for (const layer of layers) {
      if (result !== undefined) break;
      const isError = layer.fn.length === 4;
      if (Boolean(error) !== isError) continue;
      let match;
      if (layer.middleware) {
        if (layer.path && !url.pathname.startsWith(layer.path)) continue;
      } else {
        if (layer.method !== request.method) continue;
        const names = [];
        const regex = new RegExp(
          "^" +
            layer.path.replace(/:[^/]+/g, (n) => {
              names.push(n.slice(1));
              return "([^/]+)";
            }) +
            "$",
        );
        match = url.pathname.match(regex);
        if (!match) continue;
        req.params = Object.fromEntries(
          names.map((n, i) => [n, decodeURIComponent(match[i + 1])]),
        );
      }
      let nextCalled = false;
      const next = (e) => {
        nextCalled = true;
        error = e;
      };
      try {
        await (isError
          ? layer.fn(error, req, res, next)
          : layer.fn(req, res, next));
      } catch (e) {
        error = e;
        nextCalled = true;
      }
      if (!nextCalled && result === undefined) {
        error = Object.assign(Error("EMPTY_RESPONSE"), { status: 500 });
      }
    }
    if (result === undefined) {
      status = error?.status || 404;
      result = JSON.stringify({ error: error?.message || "NOT_FOUND" });
      headers.set("Content-Type", "application/json");
    }
    return new Response(result, { status, headers });
  };
  return app;
}
const parser =
  (raw) =>
  (options = {}) =>
  async (req, _res, next) => {
    if (req.body === undefined) {
      try {
        const bytes = await readLimited(req.request, raw ? 1048576 : 25165824);
        req.body = raw
          ? Buffer.from(bytes)
          : bytes.length
            ? JSON.parse(new TextDecoder().decode(bytes))
            : {};
      } catch (e) {
        return next(
          Object.assign(
            Error(
              e.message === "PAYLOAD_TOO_LARGE" ? e.message : "INVALID_INPUT",
            ),
            { status: e.message === "PAYLOAD_TOO_LARGE" ? 413 : 400 },
          ),
        );
      }
    }
    next();
  };
requestRouter.raw = parser(true);
requestRouter.json = parser(false);
export async function readLimited(request, max) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > max) throw Error("PAYLOAD_TOO_LARGE");
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw Error("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }
  return all;
}
