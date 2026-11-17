const { app, BrowserWindow, protocol, net, shell, session, safeStorage, ipcMain } = require('electron');
const { join, resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { createSessionStore } = require('./session-store.cjs');
const { pathToFileURL } = require('node:url');
const { appURL, googleAuthURL, apiOrigin, policy, assetPath, authCompletion, externalURL } = require('./security.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'rankwisp', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let mainWindow;
const pendingAuth = new Map();
function receiveAuth(raw) {
  const value = authCompletion(raw);
  if (!value || !pendingAuth.has(value.ticket)) return;
  const expires = pendingAuth.get(value.ticket);
  pendingAuth.delete(value.ticket);
  if (expires < Date.now() || !mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
  mainWindow.webContents.send('rankwisp:auth-completed', value);
}
app.on('open-url', (event, url) => { event.preventDefault(); receiveAuth(url); });
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', (_event, argv) => { for (const arg of argv) receiveAuth(arg); });

async function external(raw) {
  try {
    const target = externalURL(raw);
    if (target) await shell.openExternal(target);
  } catch { /* The renderer reports actionable checkout/auth errors separately. */ }
}

if (primaryInstance) app.whenReady().then(() => {
  // Installed bundles register this scheme on macOS; Windows/Linux use the executable.
  if (app.isPackaged) app.setAsDefaultProtocolClient('rankwisp');
  else if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient('rankwisp', process.execPath, [resolve(process.argv[1])]);
  const root = resolve(__dirname, '../dist');
  let config = {};
  try { config = JSON.parse(readFileSync(join(root, 'native-config.json'), 'utf8')); } catch {}
  const configuredOrigin = apiOrigin(config);
  const csp = policy(configuredOrigin);
  const sessionFile = join(app.getPath('userData'), 'session.enc');
  function trusted(event) {
    if (event.senderFrame !== event.sender.mainFrame || !appURL(event.senderFrame?.url)) throw Error('UNTRUSTED_ORIGIN');
  }
  const sessionStore = createSessionStore(safeStorage, sessionFile);
  ipcMain.handle('rankwisp:get-session', (event) => {
    trusted(event);
    return sessionStore.get();
  });
  ipcMain.handle('rankwisp:set-session', (event, value) => {
    trusted(event);
    return sessionStore.set(value);
  });
  ipcMain.handle('rankwisp:open-auth', async (event, value) => {
    trusted(event);
    const target = googleAuthURL(value, configuredOrigin);
    const ticket = new URL(target).searchParams.get('ticket');
    for (const [key, expires] of pendingAuth) if (expires < Date.now()) pendingAuth.delete(key);
    if (ticket) pendingAuth.set(ticket, Date.now() + 600000);
    try { await shell.openExternal(target); }
    catch (error) { if (ticket) pendingAuth.delete(ticket); throw error; }
  });

  protocol.handle('rankwisp', async (req) => {
    const file = assetPath(root, req.url);
    if (!file || !['GET', 'HEAD'].includes(req.method)) return new Response('Not found', { status: 404 });
    try {
      const response = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', csp);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Referrer-Policy', 'no-referrer');
      headers.set('Cache-Control', 'no-store');
      return new Response(req.method === 'HEAD' ? null : response.body, { status: response.status, headers });
    } catch { return new Response('Asset unavailable', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const win = new BrowserWindow({
    width: 1360, height: 900, minWidth: 780, minHeight: 620,
    title: 'Rankwisp', backgroundColor: '#EDF2F4', icon: join(root, 'icon.png'),
    webPreferences: { preload: join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false },
  });
  mainWindow = win;
  win.webContents.setWindowOpenHandler(({ url }) => { void external(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event, url) => {
    if (!appURL(url)) { event.preventDefault(); void external(url); }
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  void win.loadURL('rankwisp://app/app');
});
app.on('window-all-closed', () => app.quit());
