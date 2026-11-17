const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "rankwisp",
  Object.freeze({
    platform: process.platform,
    version: "0.1.0",
    openAuth: (url) => ipcRenderer.invoke("rankwisp:open-auth", url),
    getSession: () => ipcRenderer.invoke("rankwisp:get-session"),
    setSession: (token) => ipcRenderer.invoke("rankwisp:set-session", token),
  }),
);
