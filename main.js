const { app, BrowserWindow } = require('electron');
const path = require('path');
const { fork } = require('child_process');

// Enable Web Bluetooth and Experimental Features for Windows
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-web-bluetooth');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "EAGLE-Δ Controller"
  });

  // Start the Express backend
  const backendPath = path.join(__dirname, 'backend', 'server.js');
  backendProcess = fork(backendPath, [], {
    execPath: 'node', // Use system Node.js to bypass Electron ABI mismatch for better-sqlite3
    env: { ...process.env, EAGLE_DELTA_PORT: 4032 }
  });

  backendProcess.on('message', (msg) => {
    console.log('[Backend]', msg);
  });

  // Load the production build of the React frontend
  mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));

  // Web Bluetooth Handler for BLE Provisioning
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault(); // Prevent default selection dialog
    const target = deviceList.find((device) => device.deviceName.startsWith('EAGLE-'));
    if (target) {
      callback(target.deviceId);
    } else {
      callback(''); // Cancel
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
