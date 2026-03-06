/**
 * W-Beli.Ai Pro — Electron Development Entry Point
 * 
 * This is a simplified version of electron.cjs for local development.
 * It starts `tsx server.ts` as a child process and opens an Electron window.
 * 
 * Usage: npm run electron:dev
 */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: "W-Beli.Ai Pro (Dev)",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Wait a moment for server to start, then load
  setTimeout(() => {
    mainWindow.loadURL("http://localhost:3000");
  }, 3000);
}

app.whenReady().then(() => {
  // Start backend automatically
  console.log("🚀 Starting dev server (tsx server.ts)...");
  backendProcess = spawn("npx", ["tsx", "server.ts"], {
    cwd: __dirname,
    shell: true,
    stdio: "inherit",
  });

  backendProcess.on("error", (err) => {
    console.error("❌ Failed to start backend:", err);
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== "darwin") app.quit();
});
