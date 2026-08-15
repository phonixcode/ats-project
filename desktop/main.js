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
  return app.getPath('userData');
}

function logFile() {
  const dir = path.join(dataDir(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'api.log');
}

function resolveBackendMain() {
  const candidates = [
    path.join(process.resourcesPath, 'backend', 'src', 'main.js'),
    path.join(process.resourcesPath, 'backend', 'dist', 'src', 'main.js'),
    path.join(__dirname, '..', 'backend', 'dist', 'src', 'main.js'),
    path.join(__dirname, '..', 'backend', 'dist', 'main.js'),
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function backendCwd(mainFile) {
  let dir = path.dirname(mainFile);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'node_modules', '@nestjs', 'core'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return path.join(__dirname, '..', 'backend');
}

function crashDetail(output, code, logPath) {
  const text = output.trim();
  if (!text) {
    return `MG-ATS could not start (exit ${code}). See ${logPath}`;
  }
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    /ERR_DLOPEN_FAILED|NODE_MODULE_VERSION|compiled against|Error:/.test(line),
  );
  const slice = (start >= 0 ? lines.slice(start, start + 8) : lines.slice(-8)).join('\n');
  return `MG-ATS could not start.\n\n${slice}`;
}

function nodeCommand() {
  if (!app.isPackaged) {
    return process.env.npm_node_execpath || process.env.NODE_BINARY || 'node';
  }
  return process.execPath;
}

function startApi() {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const backendMain = resolveBackendMain();
  if (!backendMain) {
    return Promise.reject(
      new Error('API build not found. From the project folder run: cd backend && npm run build'),
    );
  }

  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: '0',
    MG_ATS_DATA_DIR: dir,
    MG_ATS_STATIC: staticDir(),
    DATABASE_URL: `file:${path.join(dir, 'mg-ats.db')}`,
  };
  if (app.isPackaged) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  const logPath = logFile();
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  return new Promise((resolve, reject) => {
    let settled = false;
    let ready = false;
    let output = '';
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(value);
    };

    apiProcess = spawn(nodeCommand(), [backendMain], {
      cwd: backendCwd(backendMain),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onData = (chunk) => {
      const text = chunk.toString();
      output += text;
      logStream.write(text);
      const match = text.match(/MG_ATS_READY (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) {
        ready = true;
        apiBase = match[1];
        finish(null, apiBase);
      }
    };
    apiProcess.stdout.on('data', onData);
    apiProcess.stderr.on('data', onData);
    apiProcess.on('error', (error) => {
      finish(new Error(`MG-ATS could not start the API. ${error.message}`));
    });
    apiProcess.on('exit', (code) => {
      if (ready) return;
      finish(new Error(crashDetail(output, code, logPath)));
    });
    setTimeout(() => {
      if (!ready) {
        finish(new Error('MG-ATS took too long to start. Try again.'));
      }
    }, 20000);
  });
}

function staticDir() {
  const packaged = path.join(process.resourcesPath, 'ui');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'frontend', 'dist');
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
