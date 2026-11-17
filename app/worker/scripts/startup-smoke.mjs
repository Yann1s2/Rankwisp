// Unlike Vitest, this starts the actual bundled module in workerd's global scope.
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const cli = resolve("node_modules/wrangler/bin/wrangler.js");
const tempRoot = resolve(".wrangler/startup-smoke");
await mkdir(tempRoot, { recursive: true });
const state = await mkdtemp(tempRoot + "/run-");
const port = Number(process.env.WORKER_SMOKE_PORT || 8793);
let log = "";
function run(args) {
  const child = spawn(process.execPath, [cli, ...args], {
    env: { ...process.env, CI: "true" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (data) => {
    log = (log + data).slice(-16000);
  });
  child.stderr.on("data", (data) => {
    log = (log + data).slice(-16000);
  });
  return child;
}
let child;
try {
  const migrate = run([
    "d1",
    "migrations",
    "apply",
    "rankwisp-identity",
    "--config",
    "worker/wrangler.jsonc",
    "--local",
    "--persist-to",
    state,
  ]);
  const code = await new Promise((resolve, reject) => {
    migrate.once("error", reject);
    migrate.once("exit", resolve);
  });
  if (code !== 0) throw Error("Local D1 migration failed");
  child = run([
    "dev",
    "--config",
    "worker/wrangler.jsonc",
    "--local",
    "--port",
    String(port),
    "--persist-to",
    state,
    "--var",
    "NODE_ENV:development",
    "--var",
    `PUBLIC_ORIGIN:http://127.0.0.1:${port}`,
  ]);
  let healthy = false;
  for (let n = 0; n < 60; n++) {
    if (child.exitCode !== null) break;
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (r.ok) {
        const body = await r.json();
        if (body.runtime === "cloudflare-workers") {
          healthy = true;
          break;
        }
      }
    } catch {}
    await delay(500);
  }
  if (!healthy) throw Error("Bundled workerd startup did not become healthy");
  console.log("Bundled workerd startup, local D1 and health: PASS");
} catch (error) {
  console.error(error.message + "\n" + log);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((r) => child.once("exit", r)),
      delay(3000),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await rm(state, { recursive: true, force: true });
}
