import { Capacitor, registerPlugin } from "@capacitor/core";
export const native = Capacitor.isNativePlatform() || !!window.rankwisp;
export const ios = Capacitor.getPlatform() === "ios";
export const Store = registerPlugin("RankwispStore");
let token = null;
const secureSession =
  window.rankwisp ||
  (ios
    ? {
        getSession: async () => (await Store.getSession()).token,
        setSession: (value) => Store.setSession({ token: value || "" }),
      }
    : null);
const sessionReady = secureSession
  ? secureSession
      .getSession()
      .then((value) => {
        token = value || null;
      })
      .catch(() => {})
  : Promise.resolve();
export const apiOrigin =
  import.meta.env.VITE_API_ORIGIN || (native ? "http://127.0.0.1:4318" : "");
export async function api(path, body, method) {
  try {
    await sessionReady;
    const response = await fetch(apiOrigin + "/api" + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: {
        "Content-Type": "application/json",
        ...(native ? { "X-Rankwisp-Client": "native" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: native ? "omit" : "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(Error(data.error || "NETWORK"), {
        status: response.status,
      });
    if (data.token) {
      token = data.token;
      await secureSession?.setSession(token).catch(() => {});
    }
    return data;
  } catch (e) {
    if (e instanceof TypeError) throw Error("NETWORK");
    throw e;
  }
}
export function clearToken() {
  token = null;
  secureSession?.setSession("").catch(() => {});
}
export async function exportFile(data, name = "rankwisp-export.json") {
  const content = JSON.stringify(data, null, 2);
  if (ios) {
    await Store.shareExport({ content, filename: name });
    return;
  }
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
