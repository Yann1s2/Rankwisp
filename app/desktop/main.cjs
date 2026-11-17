const {
  app,
  BrowserWindow,
  protocol,
  net,
  shell,
  session,
  safeStorage,
  ipcMain,
} = require("electron");
const { join, resolve, extname } = require("node:path");
const { existsSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
protocol.registerSchemesAsPrivileged([
  {
    scheme: "rankwisp",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
function external(url) {
  try {
    const u = new URL(url);
    if (
      (u.protocol === "https:" &&
        ["apps.apple.com", "checkout.stripe.com"].includes(u.hostname)) ||
      (u.protocol === "mailto:" && u.pathname === "info@zhstudio.ch")
    )
      shell.openExternal(url);
  } catch {}
}
app.whenReady().then(() => {
  const sessionFile = join(app.getPath("userData"), "session.enc");
  function trusted(event) {
    if (!event.senderFrame?.url.startsWith("rankwisp://app/"))
      throw Error("Untrusted origin");
  }
  ipcMain.handle("rankwisp:get-session", (event) => {
    trusted(event);
    if (!safeStorage.isEncryptionAvailable() || !existsSync(sessionFile))
      return "";
    try {
      return safeStorage.decryptString(readFileSync(sessionFile));
    } catch {
      return "";
    }
  });
  ipcMain.handle("rankwisp:set-session", (event, value) => {
    trusted(event);
    if (value === "") {
      rmSync(sessionFile, { force: true });
      return;
    }
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value))
      throw Error("Invalid session");
    if (!safeStorage.isEncryptionAvailable())
      throw Error("Secure storage unavailable");
    writeFileSync(sessionFile, safeStorage.encryptString(value), {
      mode: 0o600,
    });
  });

  const root = resolve(__dirname, "../dist");
  protocol.handle("rankwisp", (req) => {
    const url = new URL(req.url);
    if (url.hostname !== "app")
      return new Response("Not found", { status: 404 });
    let path = resolve(root, "." + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + "/")) path = join(root, "index.html");
    if (!extname(path) || !existsSync(path)) path = join(root, "index.html");
    return net.fetch(pathToFileURL(path).href);
  });
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 780,
    minHeight: 620,
    title: "Rankwisp",
    backgroundColor: "#f6f7f3",
    icon: join(__dirname, "../dist/icon.png"),
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    external(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("rankwisp://app/")) {
      event.preventDefault();
      external(url);
    }
  });
  win.webContents.on("will-attach-webview", (event) => event.preventDefault());
  win.loadURL("rankwisp://app/app");
});
app.on("window-all-closed", () => app.quit());
