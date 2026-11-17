const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

function fileLogger(logPath) {
  const write = (level) => (message) => {
    const line = `${new Date().toISOString()} [updater] ${level} ${message}\n`;
    fs.appendFile(logPath, line, () => undefined);
  };
  return { info: write('INFO'), warn: write('WARN'), error: write('ERROR'), debug: () => undefined };
}

function setupAutoUpdates({ getWindow, logPath }) {
  let manualCheck = false;
  let askedAbout = null;

  autoUpdater.logger = fileLogger(logPath);
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const showMessage = (options) => {
    const win = getWindow();
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
  };

  autoUpdater.on('update-available', async (info) => {
    if (askedAbout === info.version && !manualCheck) return;
    askedAbout = info.version;
    manualCheck = false;
    const { response } = await showMessage({
      type: 'info',
      title: 'Update available',
      message: `MG-ATS ${info.version} is ready to download.`,
      detail: `You have ${app.getVersion()}. Your roles, candidates, decisions and settings stay exactly as they are.`,
      buttons: ['Update now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', () => {
    if (!manualCheck) return;
    manualCheck = false;
    showMessage({ type: 'info', title: 'No updates', message: `You have the latest MG-ATS (${app.getVersion()}).` });
  });

  autoUpdater.on('download-progress', (progress) => {
    getWindow()?.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    getWindow()?.setProgressBar(-1);
    const { response } = await showMessage({
      type: 'info',
      title: 'Update ready',
      message: `MG-ATS ${info.version} is downloaded.`,
      detail: 'Restart now to install it. MG-ATS closes, updates and opens again. If you choose Later, it installs the next time you close MG-ATS.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) setImmediate(() => autoUpdater.quitAndInstall(true, true));
  });

  autoUpdater.on('error', (error) => {
    getWindow()?.setProgressBar(-1);
    if (!manualCheck) return;
    manualCheck = false;
    dialog.showErrorBox('MG-ATS', `Couldn’t check for updates. Check the internet connection and try again.\n\n${error.message}`);
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => undefined);
  check();
  setInterval(check, CHECK_EVERY_MS);

  return () => {
    manualCheck = true;
    check();
  };
}

module.exports = { setupAutoUpdates };
