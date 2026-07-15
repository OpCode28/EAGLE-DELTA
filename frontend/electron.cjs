const { app, BrowserWindow } = require("electron");
const path = require("path");

// Disable GPU cache to avoid access denied errors on Windows
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("disable-gpu-compositing");

// Keep a reference to the window object so it's not garbage collected
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // Keep this false for security
      contextIsolation: true,
    },
    icon: path.join(__dirname, "public", "netra32-logo.png"),
  });

  // Load the built React app
  mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));

  // Open the DevTools to debug
  mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
