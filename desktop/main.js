const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { setupAutoUpdates } = require('./updater');
const diagnostics = require('./diagnostics');

let mainWindow = null;
let checkForUpdatesNow = null;
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

if (process.platform === 'win32') {
  app.setAppUserModelId('com.mgats.desktop');
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

function apiHeapFlags() {
  const gb = os.totalmem() / 1024 ** 3;
  if (gb <= 6) return ['--max-old-space-size=256'];
  if (gb <= 12) return ['--max-old-space-size=512'];
  return [];
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
    NO_COLOR: '1',
    DATABASE_URL: `file:${path.join(dir, 'mg-ats.db')}`,
  };
  if (app.isPackaged) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  const logPath = logFile();
  diagnostics.rotateIfLarge(logPath);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(
    `\n=== MG-ATS ${app.getVersion()} started ${new Date().toISOString()} | RAM ${Math.round(os.totalmem() / 1024 ** 3)}GB | API flags ${apiHeapFlags().join(' ') || 'none'} ===\n`,
  );
  const readyFile = path.join(dir, 'api.ready');
  try {
    fs.unlinkSync(readyFile);
  } catch {
    /* first launch */
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let ready = false;
    let output = '';
    const timers = { poll: null, timeout: null };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearInterval(timers.poll);
      clearTimeout(timers.timeout);
      if (error) reject(error);
      else resolve(value);
    };
    const markReady = (url) => {
      ready = true;
      apiBase = url;
      finish(null, apiBase);
    };

    apiProcess = spawn(nodeCommand(), [...apiHeapFlags(), backendMain], {
      cwd: backendCwd(backendMain),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const onData = (chunk) => {
      const text = chunk.toString();
      output += text;
      logStream.write(text);
      const match = text.match(/MG_ATS_READY (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) markReady(match[1]);
    };
    apiProcess.stdout.on('data', onData);
    apiProcess.stderr.on('data', onData);
    apiProcess.on('error', (error) => {
      finish(new Error(`MG-ATS could not start the API. ${error.message}`));
    });
    apiProcess.on('exit', (code) => {
      if (ready) {
        diagnostics.recordEvent('api-exited', { code });
        return;
      }
      finish(new Error(crashDetail(output, code, logPath)));
    });
    timers.poll = setInterval(() => {
      let url = '';
      try {
        url = fs.readFileSync(readyFile, 'utf8').trim();
      } catch {
        return;
      }
      const match = url.match(/^(http:\/\/127\.0\.0\.1:\d+)$/);
      if (match) markReady(match[1]);
    }, 250);
    timers.timeout = setTimeout(() => {
      if (ready) return;
      const hint =
        'Close other programs so this PC has more memory, then open MG-ATS again.';
      const extra = output.trim()
        ? `\n\n${output.trim().split(/\r?\n/).slice(-8).join('\n')}`
        : '';
      finish(new Error(`MG-ATS took too long to start. ${hint}${extra}`));
    }, 300000);
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
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.on('unresponsive', () => diagnostics.recordEvent('window-unresponsive'));
  mainWindow.on('responsive', () => diagnostics.recordEvent('window-responsive'));
  mainWindow.webContents.on('render-process-gone', (_event, details) =>
    diagnostics.recordEvent('window-crashed', { reason: details.reason }),
  );
  mainWindow.webContents.once('did-finish-load', () => {
    diagnostics.mark('windowLoaded');
    diagnostics.startRecorder({ logsDir: path.dirname(logFile()), apiBase: () => apiBase });
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(apiBase)) event.preventDefault();
  });
  mainWindow.loadURL(apiBase);
}

async function exportLogs() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export MG-ATS logs',
    defaultPath: path.join(app.getPath('desktop'), `mg-ats-logs-${stamp}.log`),
    filters: [{ name: 'Log files', extensions: ['log', 'txt'] }],
  });
  if (canceled || !filePath) return;
  try {
    await fs.promises.copyFile(logFile(), filePath);
    shell.showItemInFolder(filePath);
  } catch (error) {
    dialog.showErrorBox('MG-ATS', `Could not export logs. ${error.message}`);
  }
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Open logs folder',
          click: () => shell.openPath(path.dirname(logFile())),
        },
        {
          label: 'Export logs…',
          click: exportLogs,
        },
        {
          label: 'Export diagnostics…',
          click: () =>
            diagnostics.exportDiagnostics({
              window: mainWindow,
              logsDir: path.dirname(logFile()),
              dataDir: dataDir(),
              apiBase: () => apiBase,
            }),
        },
        { type: 'separator' },
        {
          label: 'Check for updates…',
          enabled: app.isPackaged,
          click: () => checkForUpdatesNow?.(),
        },
        { label: `Version ${app.getVersion()}`, enabled: false },
      ],
    },
  ]);
}

ipcMain.on('mg-ats:api-base', (event) => {
  event.returnValue = apiBase;
});

app.on('child-process-gone', (_event, details) => {
  if (details.reason !== 'clean-exit') {
    diagnostics.recordEvent('process-gone', { process: details.type, reason: details.reason });
  }
});

app.whenReady().then(async () => {
  diagnostics.mark('appReady');
  Menu.setApplicationMenu(buildMenu());
  try {
    await startApi();
    diagnostics.mark('apiReady');
    createWindow();
    if (app.isPackaged) {
      checkForUpdatesNow = setupAutoUpdates({ getWindow: () => mainWindow, logPath: logFile() });
    }
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
