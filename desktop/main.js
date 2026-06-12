// Electron main process - boots local FastAPI backend, then renders the React UI.
const { app, BrowserWindow, Menu, shell, dialog, nativeImage } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const BACKEND_PORT = 51808;
const FRONTEND_PORT = 51807;
let backendProc = null;
let win = null;
let backendRestartCount = 0;
const MAX_BACKEND_RESTARTS = 5;
let backendRestartTimer = null;

function getAppIconPath() {
  return path.join(__dirname, "assets", "icon.png");
}

function applyAppBranding() {
  app.setName("Insapi Marketing");
  app.setAppUserModelId("com.insapi.marketing");

  if (process.platform === "darwin" && app.dock) {
    const icon = nativeImage.createFromPath(getAppIconPath());
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }
}

function logStartup(message) {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.appendFileSync(path.join(app.getPath("userData"), "startup.log"), line);
  } catch {}
}

function getBackendBinary() {
  // In production (packaged), backend is bundled as a PyInstaller exe under resources/backend/
  if (app.isPackaged) {
    const exe = process.platform === "win32" ? "insapi-marketing-backend.exe" : "insapi-marketing-backend";
    return path.join(process.resourcesPath, "backend", exe);
  }
  // In dev, run via system python (assumes backend is installed locally)
  return null;
}

function createBackendEnv(dataDir) {
  const env = { ...process.env };

  // A system Python install can define these and break PyInstaller's embedded
  // interpreter before it can import the standard library encodings package.
  for (const key of Object.keys(env)) {
    if (key.toUpperCase().startsWith("PYTHON") || key.toUpperCase() === "VIRTUAL_ENV") {
      delete env[key];
    }
  }

  return {
    ...env,
    PORT: String(BACKEND_PORT),
    HOST: "127.0.0.1",
    DATA_DIR: dataDir,
    SQLITE_PATH: path.join(dataDir, "insapi_marketing_workspace.sqlite3"),
    CORS_ORIGINS: "*",
  };
}

function startBackend() {
  const binary = getBackendBinary();
  const dataDir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const env = createBackendEnv(dataDir);
  logStartup(`Starting backend. packaged=${app.isPackaged} binary=${binary || "dev-python"}`);

  if (binary && fs.existsSync(binary)) {
    // Production: Run backend silently — windowed mode exe, no console at all
    backendProc = spawn(binary, [], {
      env,
      stdio: "ignore",     // No stdio — windowed PyInstaller exe has none
      windowsHide: true,   // Belt-and-suspenders: also hide any window
      detached: false,
    });
    logStartup(`Backend process spawned. pid=${backendProc.pid || "unknown"}`);
  } else {
    // Dev fallback: assume uvicorn is in PATH
    const cwd = path.join(__dirname, "..", "backend");
    const devEnv = {
      ...process.env,
      PORT: env.PORT,
      HOST: env.HOST,
      DATA_DIR: env.DATA_DIR,
      SQLITE_PATH: process.env.SQLITE_PATH || env.SQLITE_PATH,
      CORS_ORIGINS: env.CORS_ORIGINS,
    };
    backendProc = spawn(
      process.platform === "win32" ? "python.exe" : "python3",
      ["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
      { cwd, env: devEnv, stdio: "inherit" }
    );
    logStartup(`Dev backend process spawned. pid=${backendProc.pid || "unknown"}`);
  }

  backendProc.on("error", (error) => {
    logStartup(`Backend spawn error: ${error.stack || error.message || String(error)}`);
  });

  backendProc.on("exit", (code, signal) => {
    logStartup(`Backend exited. code=${code} signal=${signal}`);
    console.log("backend exited", code, signal);
    backendProc = null;

    // Auto-restart unless the app is quitting intentionally
    if (app.isQuitting) return;
    if (backendRestartCount < MAX_BACKEND_RESTARTS) {
      backendRestartCount++;
      const delay = Math.min(1000 * backendRestartCount, 5000); // 1s, 2s, 3s, 4s, 5s
      logStartup(`Scheduling backend restart #${backendRestartCount} in ${delay}ms`);
      backendRestartTimer = setTimeout(() => {
        logStartup(`Restarting backend (attempt ${backendRestartCount}/${MAX_BACKEND_RESTARTS})`);
        startBackend();
      }, delay);
    } else {
      logStartup(`Backend exceeded max restarts (${MAX_BACKEND_RESTARTS}). Giving up.`);
      if (win) {
        win.webContents.executeJavaScript(
          `document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050505;color:#fff;font-family:sans-serif;flex-direction:column;gap:16px"><h2>Backend stopped unexpectedly</h2><p style=\'color:#888\'>Please restart the application.</p></div>'`
        ).catch(() => {});
      }
    }
  });
}

function waitForBackend(retries = 60) {
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get({ host: "127.0.0.1", port: BACKEND_PORT, path: "/api/" }, (res) => {
          if (res.statusCode === 200) resolve();
          else retry();
        })
        .on("error", retry);
    };
    const retry = () => {
      if (--retries <= 0) reject(new Error("backend timeout"));
      else setTimeout(tryOnce, 500);
    };
    tryOnce();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#050505",
    title: "Insapi Marketing",
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,  // Don't show until ready
  });

  // Show window when ready to prevent white flash
  win.once("ready-to-show", () => {
    win.show();
  });

  const indexFile = path.join(__dirname, "web", "index.html");
  if (fs.existsSync(indexFile)) {
    win.loadFile(indexFile);
  } else {
    // dev mode - point at CRA dev server
    win.loadURL(`http://localhost:${FRONTEND_PORT}`);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(async () => {
  applyAppBranding();
  Menu.setApplicationMenu(null);
  logStartup("App ready");
  try {
    startBackend();
    await waitForBackend();
    logStartup("Backend health check passed");
  } catch (e) {
    logStartup(`Startup failed: ${e.stack || e.message || String(e)}`);
    dialog.showErrorBox(
      "Insapi Marketing - Startup Error",
      "Unable to start the application backend.\n\n" +
      "Please try:\n" +
      "1. Restart your computer\n" +
      "2. Reinstall the application\n" +
      "3. Contact support@insapimarketing.com\n\n" +
      "Error details: " + String(e)
    );
    app.quit();
    return;
  }
  createWindow();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (backendRestartTimer) clearTimeout(backendRestartTimer);
  if (backendProc) {
    try { backendProc.kill(); } catch {}
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
