// Preload - exposes backend URL and platform info to the renderer
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("insapiMarketing", {
  version: "1.0.0",
  platform: process.platform,
  backendUrl: "http://127.0.0.1:51808",
});
