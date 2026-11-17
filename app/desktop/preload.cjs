const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "rankwisp",
  Object.freeze({
    platform: process.platform,
    version: "0.1.0",
    openAuth: (url) => ipcRenderer.invoke("rankwisp:open-auth", url),
    onAuthCompleted: (callback) => {
      if (typeof callback !== "function") throw Error("INVALID_LISTENER");
      const listener = (_event, value) => callback({ ticket: value.ticket, code: value.code });
      ipcRenderer.on("rankwisp:auth-completed", listener);
      return () => ipcRenderer.removeListener("rankwisp:auth-completed", listener);
    },
    getSession: () => ipcRenderer.invoke("rankwisp:get-session"),
    setSession: (token) => ipcRenderer.invoke("rankwisp:set-session", token),
  }),
);
