import { Capacitor, registerPlugin } from "@capacitor/core";
export const native = Capacitor.isNativePlatform() || !!window.rankwisp;
export const ios = Capacitor.getPlatform() === "ios";
export const Store = registerPlugin("RankwispStore");
let token = null;
let storageError = false;
const secureSession = window.rankwisp || (ios ? {
  getSession: async () => (await Store.getSession()).token,
  setSession: (value) => Store.setSession({ token: value || "" }),
} : null);
const fail = (code, status) => Object.assign(new Error(code), { status });
// AbortSignal.timeout/any are unavailable on supported iOS 15.4–17.3.
function requestSignal(ms, caller) {
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  if (caller?.aborted) cancel();
  else caller?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  return {
    signal: controller.signal,
    get timedOut() { return timedOut; },
    dispose() { clearTimeout(timer); caller?.removeEventListener("abort", cancel); },
  };
}
async function bounded(promise, ms, code) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(fail(code)), ms); })]); }
  finally { clearTimeout(timer); }
}
const sessionReady = secureSession ? bounded(secureSession.getSession(), 65000, "SECURE_STORAGE_UNAVAILABLE")
  .then(value => { token = value || null; })
  .catch(() => { storageError = true; }) : Promise.resolve();
export async function retrySecureSession() {
  await sessionReady;
  if (!secureSession || !storageError) return;
  try {
    token = (await bounded(secureSession.getSession(), 65000, "SECURE_STORAGE_UNAVAILABLE")) || null;
    storageError = false;
  } catch { throw fail("SECURE_STORAGE_UNAVAILABLE"); }
}
// Native production builds must supply the deployed HTTPS origin. Only Vite development
// may use localhost; a release without a configured backend reports configuration failure.
export const apiOrigin = import.meta.env.VITE_API_ORIGIN || (native ? (import.meta.env.DEV ? "http://127.0.0.1:4318" : "") : "");
function endpoint(path) {
  if (native && !apiOrigin) throw fail("API_NOT_CONFIGURED");
  return apiOrigin + "/api" + path;
}
async function rememberSession(value) {
  if (!secureSession) { token = value; return; }
  try {
    await bounded(secureSession.setSession(value), 65000, "SECURE_STORAGE_UNAVAILABLE");
    storageError = false; token = value;
  } catch {
    // Do not tell the user login persisted when their OS rejected secure storage.
    token = null; storageError = true;
    const cleanup = requestSignal(5000);
    await fetch(endpoint("/auth/logout"), { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${value}`,"X-Rankwisp-Client":"native"},body:"{}",credentials:"omit",signal:cleanup.signal }).catch(()=>{}).finally(()=>cleanup.dispose());
    throw fail("SECURE_STORAGE_UNAVAILABLE");
  }
}
async function request(path, body, method, signal) {
  await sessionReady;
  if (storageError && path === "/me") throw fail("SECURE_STORAGE_UNAVAILABLE");
  const timeout = requestSignal(45000, signal);
  let data;
  try {
    const response = await fetch(endpoint(path), {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {"Content-Type":"application/json", ...(native ? {"X-Rankwisp-Client":"native"}:{}), ...(token ? {Authorization:`Bearer ${token}`}:{})},
      credentials:native ? "omit":"include",
      body:body === undefined ? undefined:JSON.stringify(body), signal:timeout.signal,
    });
    if (!response.headers.get("content-type")?.includes("application/json"))
      throw fail("SERVICE_UNAVAILABLE", response.status >= 400 ? response.status : 502);
    try { data = await response.json(); }
    catch (error) { if (timeout.signal.aborted) throw error; throw fail("SERVICE_UNAVAILABLE", 502); }
    if (!response.ok) throw fail(data.error || "SERVICE_UNAVAILABLE",response.status);
  } catch(e) {
    if (signal?.aborted) throw fail("REQUEST_CANCELLED");
    if (timeout.timedOut) throw fail("REQUEST_TIMEOUT");
    if (e instanceof TypeError) throw fail("NETWORK");
    throw e;
  } finally { timeout.dispose(); }
  if (data.token) await rememberSession(data.token);
  return data;
}
export async function api(path, body, method, options = {}) {
  const data = await request(path,body,method,options.signal);
  // Durable refresh jobs keep progressing even if the client disconnects. Poll only
  // the returned job; no automatic replay of the mutation on transport failures.
  if (data.jobId && path.endsWith("/refresh")) {
    const deadline = Date.now() + 12 * 60 * 1000;
    while (Date.now() < deadline) {
      await delay(1500,options.signal);
      const job = await request("/jobs/" + encodeURIComponent(data.jobId),undefined,undefined,options.signal);
      if (job.status === "completed") return job;
      if (job.status === "failed" || job.status === "cancelled") throw fail(job.error || "REFRESH_FAILED");
    }
    throw fail("REFRESH_CONTINUES");
  }
  return data;
}
function delay(ms,signal) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted) return reject(fail("REQUEST_CANCELLED"));
    const onAbort=()=>{clearTimeout(timer);reject(fail("REQUEST_CANCELLED"));};
    const timer=setTimeout(()=>{signal?.removeEventListener("abort",onAbort);resolve();},ms);
    signal?.addEventListener("abort",onAbort,{once:true});
  });
}
function base64url(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,""); }
let signInPending = false;
export const beginGoogleSignIn = (options) => beginProviderSignIn("google", options);
export const beginAppleSignIn = (options) => beginProviderSignIn("apple", options);
async function beginProviderSignIn(provider, { signal } = {}) {
  const codePrefix = provider.toUpperCase();
  if (!native) {
    const url = new URL(endpoint(`/auth/${provider}/start`),window.location.origin);
    url.searchParams.set("returnTo","/app/");url.searchParams.set("platform","web");
    window.location.assign(url.href);
    return new Promise(()=>{});
  }
  if (signInPending) throw fail(codePrefix + "_ALREADY_PENDING");
  signInPending=true;
  try {
    const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge=base64url(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));
    const {url,ticket,expiresIn}=await request(`/auth/${provider}/native/start`,{challenge,platform:ios?"ios":"desktop"},undefined,signal);
    // The browser delivers a second secret through this device's URL handler.
    // Polling with the public ticket and original verifier alone cannot obtain a
    // session, even if someone forwards the sign-in link to another device.
    let cleanupListener = () => {};
    let completionTimer;
    let cancelCompletion;
    let resolveCompletion;
    let rejectCompletion;
    const completion = new Promise((resolve, reject) => { resolveCompletion=resolve; rejectCompletion=reject; });
    completion.catch(() => {});
    const onComplete = (result) => {
      if (result?.ticket === ticket && /^[A-Za-z0-9_-]{43}$/.test(result.code || "")) resolveCompletion(result.code);
    };
    try {
      if (window.rankwisp) cleanupListener = window.rankwisp.onAuthCompleted(onComplete);
      else {
        const listener = await Store.addListener("authCompleted", onComplete);
        cleanupListener = () => listener.remove();
      }
      cancelCompletion = () => rejectCompletion(fail("REQUEST_CANCELLED"));
      if(signal?.aborted) throw fail("REQUEST_CANCELLED");
      signal?.addEventListener("abort",cancelCompletion,{once:true});
      completionTimer=setTimeout(()=>rejectCompletion(fail(codePrefix + "_EXPIRED")),Math.min(expiresIn||600,600)*1000);
      if (window.rankwisp) await window.rankwisp.openAuth(url);
      else await Store.openAuth({url});
      const completionCode = await completion;
      const result = await request(`/auth/${provider}/native/exchange`,{ticket,verifier,completionCode},undefined,signal);
      if (!result.token) throw fail(codePrefix + "_AUTH_FAILED");
      return result;
    } finally {
      clearTimeout(completionTimer);
      signal?.removeEventListener("abort",cancelCompletion);
      await cleanupListener();
    }
  } finally { signInPending=false; }
}
export function clearToken() {
  token=null;
  if (secureSession) secureSession.setSession("").catch(()=>{
    window.dispatchEvent(new CustomEvent("rankwisp:session-error",{detail:"SECURE_STORAGE_UNAVAILABLE"}));
  });
}
export async function exportFile(data,name="rankwisp-export.json") {
  const content=JSON.stringify(data,null,2);
  if (ios) { await Store.shareExport({content,filename:name});return; }
  const url=URL.createObjectURL(new Blob([content],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
