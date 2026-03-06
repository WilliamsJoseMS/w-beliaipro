/**
 * W-Beli.Ai Pro — Electron Main Process (Production Build)
 * 
 * This file ONLY handles the frontend (Electron window).
 * The backend server must be started separately using run-server.bat.
 * 
 * 1. Shows a splash screen while checking for the backend server
 * 2. Opens the main Electron window once the server is detected
 * 3. Handles graceful shutdown and system tray
 */
const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

// ─── Paths ────────────────────────────────────────────────────────────
const appRoot = app.isPackaged
  ? path.join(process.resourcesPath, "app.asar")
  : __dirname;

// Writable directory for logs
const userDataPath = app.getPath("userData");

// ─── Logging ──────────────────────────────────────────────────────────
const logFile = path.join(userDataPath, "app.log");

function safeLog(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  try {
    if (!app.isPackaged) {
      console.log(line);
    }
    fs.appendFileSync(logFile, line + "\n");
  } catch (e) {
    // ignore EPIPE or other write errors in GUI mode
  }
}

// Truncate log file if it gets too big (>2MB)
try {
  if (fs.existsSync(logFile)) {
    const stats = fs.statSync(logFile);
    if (stats.size > 2 * 1024 * 1024) {
      fs.writeFileSync(logFile, "--- Log truncated ---\n");
    }
  }
} catch (e) { /* ignore */ }

// ─── Globals ──────────────────────────────────────────────────────────
let mainWindow;
let splashWindow;
let tray;
let isQuitting = false;

// ─── Environment Setup ───────────────────────────────────────────────
process.env.NODE_ENV = "production";

// ─── Icon Helper ──────────────────────────────────────────────────────
function getIconPath() {
  const iconLocations = [
    path.join(appRoot, "assets", "icons", "icon.ico"),
    path.join(appRoot, "public", "logo.png"),
    path.join(__dirname, "assets", "icons", "icon.ico"),
    path.join(__dirname, "public", "logo.png"),
  ];
  for (const loc of iconLocations) {
    try {
      if (fs.existsSync(loc)) return loc;
    } catch (e) { /* asar errors */ }
  }
  return null;
}

// ─── Splash Screen ────────────────────────────────────────────────────
function createSplashScreen() {
  const iconPath = getIconPath();
  const splashOptions = {
    width: 420,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  if (iconPath) {
    try {
      splashOptions.icon = nativeImage.createFromPath(iconPath);
    } catch (e) { /* ignore */ }
  }

  splashWindow = new BrowserWindow(splashOptions);

  const splashHTML = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: transparent;
        font-family: 'Segoe UI', system-ui, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        overflow: hidden;
        -webkit-app-region: drag;
      }
      .container {
        background: linear-gradient(145deg, #0d0d2b 0%, #1a1a3e 50%, #0d0d2b 100%);
        border: 1px solid rgba(167, 139, 250, 0.3);
        border-radius: 20px;
        padding: 40px 50px;
        text-align: center;
        box-shadow: 
          0 20px 60px rgba(0,0,0,0.6),
          0 0 40px rgba(167, 139, 250, 0.15),
          inset 0 1px 0 rgba(255,255,255,0.05);
        width: 380px;
      }
      .logo {
        font-size: 32px;
        font-weight: 700;
        background: linear-gradient(135deg, #a78bfa, #818cf8, #6366f1);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 8px;
        letter-spacing: -0.5px;
      }
      .subtitle {
        color: rgba(255,255,255,0.5);
        font-size: 12px;
        margin-bottom: 30px;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .spinner-container {
        margin-bottom: 24px;
      }
      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(167, 139, 250, 0.15);
        border-top: 3px solid #a78bfa;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .status {
        color: rgba(255,255,255,0.7);
        font-size: 13px;
        animation: pulse 2s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.7; }
        50% { opacity: 1; }
      }
      .dots::after {
        content: '';
        animation: dots 1.5s steps(4, end) infinite;
      }
      @keyframes dots {
        0% { content: ''; }
        25% { content: '.'; }
        50% { content: '..'; }
        75% { content: '...'; }
      }
      .hint {
        color: rgba(255,255,255,0.35);
        font-size: 11px;
        margin-top: 16px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">W-Beli.Ai Pro</div>
      <div class="subtitle">WhatsApp Automation</div>
      <div class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div class="status" id="status">Conectando al servidor<span class="dots"></span></div>
      <div class="hint">Asegúrate de que el servidor backend<br/>esté corriendo (run-server.bat)</div>
    </div>
  </body>
  </html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`);
  splashWindow.center();
  splashWindow.show();
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ─── Main Window ──────────────────────────────────────────────────────
function createWindow() {
  const iconPath = getIconPath();
  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "W-Beli.Ai Pro",
    autoHideMenuBar: true,
    frame: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a1a",
      symbolColor: "#a78bfa",
      height: 36,
    },
    backgroundColor: "#0a0a1a",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  };

  if (iconPath) {
    try {
      windowOptions.icon = nativeImage.createFromPath(iconPath);
    } catch (e) { /* ignore */ }
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showMainWindow() {
  if (!mainWindow) return;

  mainWindow.loadURL("http://localhost:3000");
  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow.show();
    mainWindow.focus();
  });
}

function showServerNotFoundWindow() {
  closeSplash();

  if (!mainWindow) createWindow();

  const errorHTML = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="background:#0a0a1a;color:#fff;font-family:'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <div style="text-align:center;max-width:520px;padding:40px;">
      <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
      <h1 style="font-size:22px;margin-bottom:12px;color:#a78bfa;">Servidor Backend No Detectado</h1>
      <p style="color:rgba(255,255,255,0.7);margin-bottom:20px;line-height:1.6;">
        No se pudo conectar al servidor backend en el puerto 3000.<br/>
        Por favor, ejecuta <strong style="color:#a78bfa;">run-server.bat</strong> primero y luego abre esta aplicación.
      </p>
      <div style="background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.3);border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="color:rgba(255,255,255,0.9);font-size:14px;margin-bottom:8px;">📋 Pasos:</p>
        <ol style="color:rgba(255,255,255,0.6);font-size:13px;text-align:left;line-height:2;">
          <li>Ejecuta <code style="color:#a78bfa;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;">run-server.bat</code></li>
          <li>Espera a que diga "Servidor listo en puerto 3000"</li>
          <li>Abre esta aplicación nuevamente</li>
        </ol>
      </div>
      <button onclick="window.location.reload()" style="background:linear-gradient(135deg,#a78bfa,#6366f1);color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;margin-right:8px;">
        🔄 Reintentar Conexión
      </button>
    </div>
  </body>
  </html>`;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`);
  mainWindow.show();
}

// ─── Check if Backend Server is Running ───────────────────────────────
function waitForServer(url, timeoutMs) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server timeout after ${timeoutMs}ms`));
      }

      const req = http.get(url + "/api/ping", (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, 800);
        }
      });

      req.on("error", () => {
        setTimeout(check, 800);
      });

      req.setTimeout(3000, () => {
        req.destroy();
        setTimeout(check, 800);
      });
    };

    // Check immediately
    setTimeout(check, 500);
  });
}

// ─── System Tray ──────────────────────────────────────────────────────
function createTray() {
  const iconPath = getIconPath();
  if (!iconPath) return;

  try {
    tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
    tray.setToolTip("W-Beli.Ai Pro");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Abrir W-Beli.Ai Pro",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: "Reintentar Conexión",
        click: () => {
          safeLog("🔄 Manual reconnect requested");
          if (mainWindow) {
            mainWindow.loadURL("http://localhost:3000");
          }
        },
      },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    safeLog(`⚠️ Could not create tray: ${e.message}`);
  }
}

// ─── Single Instance Lock ─────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────
app.whenReady().then(() => {
  safeLog("═══════════════════════════════════════════════════════");
  safeLog("🚀 W-Beli.Ai Pro (Frontend Only) starting...");
  safeLog(`   App root: ${appRoot}`);
  safeLog(`   User data: ${userDataPath}`);
  safeLog(`   Packaged: ${app.isPackaged}`);
  safeLog("═══════════════════════════════════════════════════════");

  // 1. Show splash screen
  createSplashScreen();

  // 2. Create the main window (hidden)
  createWindow();

  // 3. Create system tray
  createTray();

  // 4. Wait for the backend server (check for 15 seconds)
  safeLog("🔍 Checking if backend server is running on port 3000...");
  waitForServer("http://localhost:3000", 15000)
    .then(() => {
      safeLog("✅ Backend server detected on port 3000");
      showMainWindow();
    })
    .catch((err) => {
      safeLog(`⚠️ Backend server not detected: ${err.message}`);
      showServerNotFoundWindow();
    });
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    isQuitting = true;
    app.quit();
  }
});
