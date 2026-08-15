const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let apiProcess = null;
let apiBase = 'http://127.0.0.1:3000';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function dataDir() {
  return path.join(app.getPath('userData'));
}

function backendEntry() {
  const packaged = path.join(process.resourcesPath, 'backend', 'main.js');
  if (fs.existsSync(packaged)) return { cmd: process.execPath, args: [packaged], cwd: path.dirname(packaged) };
  const local = path.join(__dirname, '..', 'backend', 'dist', 'main.js');
  return { cmd: process.execPath, args: [local], cwd: path.join(__dirname, '..', 'backend') };
}

function staticDir() {
  const packaged = path.join(process.resourcesPath, 'ui');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'frontend', 'dist');
}

function startApi() {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const { cmd, args, cwd } = backendEntry();
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    HOST: '127.0.0.1',
    PORT: '0',
    MG_ATS_DATA_DIR: dir,
    MG_ATS_STATIC: staticDir(),
    DATABASE_URL: `file:${path.join(dir, 'mg-ats.db')}`,
  };
  return new Promise((resolve, reject) => {
    apiProcess = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const onData = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/MG_ATS_READY (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        apiBase = match[1];
        resolve(apiBase);
      }
    };
    apiProcess.stdout.on('data', onData);
    apiProcess.stderr.on('data', onData);
    apiProcess.on('error', reject);
    apiProcess.on('exit', (code) => {
      if (!apiBase || code) {
        reject(new Error('MG-ATS could not start. Try opening it again.'));
      }
    });
    setTimeout(() => reject(new Error('MG-ATS took too long to start. Try again.')), 20000);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MG-ATS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(apiBase);
}

ipcMain.on('mg-ats:api-base', (event) => {
  event.returnValue = apiBase;
});

app.whenReady().then(async () => {
  try {
    await startApi();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('MG-ATS', error.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (apiProcess) apiProcess.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (apiProcess) apiProcess.kill();
});
