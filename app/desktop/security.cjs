const { resolve, relative, sep, extname, join } = require('node:path');
const { existsSync, statSync, realpathSync } = require('node:fs');

function appURL(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'rankwisp:' && url.hostname === 'app' && !url.port && !url.username && !url.password;
  } catch { return false; }
}

function googleAuthURL(raw, configuredOrigin = null) {
  if (typeof raw !== 'string' || raw.length > 16000) throw Error('INVALID_AUTH_URL');
  const url = new URL(raw);
  if (url.username || url.password || url.hash) throw Error('INVALID_AUTH_URL');
  const google = url.protocol === 'https:' && url.hostname === 'accounts.google.com' && url.pathname === '/o/oauth2/v2/auth' && !url.port;
  const entries = [...url.searchParams.entries()];
  const ticket = configuredOrigin && url.origin === configuredOrigin && url.pathname === '/api/auth/google/start' && entries.length === 1 && entries[0][0] === 'ticket' && /^[A-Za-z0-9_-]{43}$/.test(entries[0][1]);
  if (!google && !ticket) throw Error('INVALID_AUTH_URL');
  return url.href;
}

function apiOrigin(config) {
  if (!config || typeof config.apiOrigin !== 'string' || !config.apiOrigin) return null;
  try {
    const url = new URL(config.apiOrigin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.protocol === 'https:') return url.origin;
    if (config.development === true && url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return url.origin;
  } catch {}
  return null;
}

function authCompletion(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 512) return null;
    const url = new URL(raw);
    if (url.protocol !== 'rankwisp:' || url.hostname !== 'auth' || url.pathname !== '/complete' || url.port || url.username || url.password || url.search) return null;
    const params = new URLSearchParams(url.hash.slice(1));
    if ([...params].length !== 2 || !params.has('ticket') || !params.has('code')) return null;
    const ticket = params.get('ticket'), code = params.get('code');
    return /^[A-Za-z0-9_-]{43}$/.test(ticket) && /^[A-Za-z0-9_-]{43}$/.test(code) ? { ticket, code } : null;
  } catch { return null; }
}

function externalURL(raw) {
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.port) return null;
    const provider = url.protocol === 'https:' && ['apps.apple.com', 'checkout.stripe.com'].includes(url.hostname);
    const repositoryPath = /^\/Yann1s2\/Rankwisp\/?$/.test(url.pathname)
      || /^\/Yann1s2\/Rankwisp\/releases(?:\/tag\/v[\w.-]+)?\/?$/.test(url.pathname)
      || /^\/Yann1s2\/Rankwisp\/releases\/download\/v[\w.-]+\/(?:Rankwisp-[\w.-]+\.zip|SHA256SUMS-[\w.-]+\.txt)$/.test(url.pathname);
    const repository = /^https:\/\/github\.com\//i.test(raw) && url.protocol === 'https:' && url.hostname === 'github.com' && repositoryPath && !url.search && !url.hash;
    const support = url.protocol === 'mailto:' && url.pathname === 'info@zhstudio.ch';
    return provider || repository || support ? url.href : null;
  } catch { return null; }
}

function policy(origin) {
  return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.mzstatic.com; font-src 'self'; connect-src 'self'${origin ? ' ' + origin : ''}; object-src 'none'; frame-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
}

function inside(root, file) {
  const rel = relative(root, file);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !require('node:path').isAbsolute(rel);
}

function assetPath(root, rawURL) {
  if (!appURL(rawURL)) return null;
  let pathname;
  try { pathname = decodeURIComponent(new URL(rawURL).pathname); } catch { return null; }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(part => part === '..')) return null;
  const base = resolve(root);
  let file = resolve(base, '.' + pathname);
  if (file === base) file = join(base, 'index.html');
  if (!inside(base, file)) return null;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && !extname(pathname) && /^\/(?:app(?:\/.*)?|en(?:\/.*)?|de(?:\/.*)?)\/?$/.test(pathname)) file = join(base, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  // Unpacked developer assets must not escape the bundle through symlinks.
  if (!inside(realpathSync(base), realpathSync(file))) return null;
  return file;
}

module.exports = { appURL, googleAuthURL, apiOrigin, policy, assetPath, authCompletion, externalURL };
