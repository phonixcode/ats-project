const { app, dialog, shell } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SAMPLE_EVERY_MS = 10_000;
const ROTATE_AT_BYTES = 5 * 1024 * 1024;
const LOG_TAIL_BYTES = 1024 * 1024;
const MB = 1024 * 1024;

const startup = {};
let metricsPath = null;

function mark(name) {
  startup[name] = Math.round(performance.now());
}

function rotateIfLarge(file) {
  try {
    if (fs.statSync(file).size < ROTATE_AT_BYTES) return;
    fs.renameSync(file, file.replace(/(\.\w+)$/, '.1$1'));
  } catch {
    /* nothing to rotate yet */
  }
}

function append(entry) {
  if (!metricsPath) return;
  rotateIfLarge(metricsPath);
  fs.appendFile(metricsPath, `${JSON.stringify(entry)}\n`, () => undefined);
}

function recordEvent(type, detail = {}) {
  append({ kind: 'event', at: new Date().toISOString(), type, ...detail });
}

function appProcesses() {
  return app.getAppMetrics().map((proc) => ({
    type: proc.type,
    memMb: Math.round(proc.memory.workingSetSize / 1024),
    peakMb: Math.round(proc.memory.peakWorkingSetSize / 1024),
    cpu: Math.round(proc.cpu.percentCPUUsage),
  }));
}

async function apiSnapshot(apiBase) {
  try {
    const res = await fetch(`${apiBase()}/diagnostics`, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : { error: `HTTP ${res.status}` };
  } catch (error) {
    return { error: error.message };
  }
}

function startRecorder({ logsDir, apiBase }) {
  metricsPath = path.join(logsDir, 'metrics.jsonl');
  append({
    kind: 'session',
    at: new Date().toISOString(),
    version: app.getVersion(),
    system: systemInfo(),
    startupMs: { ...startup },
  });
  const sample = async () => {
    const processes = appProcesses();
    const api = await apiSnapshot(apiBase);
    const windowMb = processes.reduce((sum, proc) => sum + proc.memMb, 0);
    append({
      kind: 'sample',
      at: new Date().toISOString(),
      totalMb: windowMb + (api.memoryMb?.rss ?? 0),
      windowMb,
      freeSystemMb: Math.round(os.freemem() / MB),
      processes,
      api,
    });
  };
  sample();
  return setInterval(sample, SAMPLE_EVERY_MS);
}

function systemInfo() {
  const cpus = os.cpus();
  let diskFreeGb = null;
  try {
    const stats = fs.statfsSync(app.getPath('userData'));
    diskFreeGb = Math.round((stats.bavail * stats.bsize) / 1024 ** 3);
  } catch {
    /* statfs unsupported */
  }
  return {
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpu: cpus[0]?.model?.trim() ?? 'unknown',
    cores: cpus.length,
    totalRamGb: Math.round(os.totalmem() / 1024 ** 3),
    diskFreeGb,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  };
}

function redact(text) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\+?\d[\d\s-]{9,}\d/g, '[phone]')
    .replace(/(sk-ant-|sk-|AIza)[\w-]{6,}/g, '[key]');
}

function readTail(file, bytes) {
  try {
    const { size } = fs.statSync(file);
    const fd = fs.openSync(file, 'r');
    const length = Math.min(size, bytes);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, size - length);
    fs.closeSync(fd);
    return buffer.toString('utf8');
  } catch {
    return '';
  }
}

function readSamples(logsDir) {
  return ['metrics.1.jsonl', 'metrics.jsonl']
    .flatMap((name) => readTail(path.join(logsDir, name), ROTATE_AT_BYTES).split('\n'))
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function folderSize(dir) {
  let files = 0;
  let bytes = 0;
  try {
    for (const entry of await fs.promises.readdir(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      files += 1;
      bytes += (await fs.promises.stat(path.join(entry.parentPath, entry.name))).size;
    }
  } catch {
    /* folder missing */
  }
  return { files, mb: Math.round(bytes / MB) };
}

function summarize(entries) {
  const samples = entries.filter((entry) => entry.kind === 'sample');
  const events = entries.filter((entry) => entry.kind === 'event');
  const sessions = entries.filter((entry) => entry.kind === 'session');
  const max = (pick) => samples.reduce((top, entry) => Math.max(top, pick(entry) ?? 0), 0);
  const min = (pick) =>
    samples.reduce((low, entry) => Math.min(low, pick(entry) ?? Infinity), Infinity);
  return {
    samples: samples.length,
    from: samples[0]?.at ?? null,
    to: samples.at(-1)?.at ?? null,
    peakTotalMb: max((entry) => entry.totalMb),
    peakWindowMb: max((entry) => entry.windowMb),
    peakApiMb: max((entry) => entry.api?.memoryMb?.rss),
    peakApiCpu: max((entry) => entry.api?.cpuPercent),
    worstEventLoopP99Ms: max((entry) => entry.api?.eventLoop?.p99Ms),
    lowestFreeSystemMb: samples.length ? min((entry) => entry.freeSystemMb) : null,
    lastStartupMs: sessions.at(-1)?.startupMs ?? null,
    events: events.reduce((counts, entry) => {
      counts[entry.type] = (counts[entry.type] ?? 0) + 1;
      return counts;
    }, {}),
  };
}

async function exportDiagnostics({ window, logsDir, dataDir, apiBase }) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const { canceled, filePath } = await dialog.showSaveDialog(window, {
    title: 'Export MG-ATS diagnostics',
    defaultPath: path.join(app.getPath('desktop'), `mg-ats-diagnostics-${stamp}.json`),
    filters: [{ name: 'Diagnostics', extensions: ['json'] }],
  });
  if (canceled || !filePath) return;

  try {
    const entries = readSamples(logsDir);
    const summary = summarize(entries);
    let reader = 'unknown';
    try {
      reader = JSON.parse(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8')).reader ?? 'builtin';
    } catch {
      /* no settings saved yet */
    }
    const dbFile = path.join(dataDir, 'mg-ats.db');
    const report = {
      generatedAt: new Date().toISOString(),
      version: app.getVersion(),
      system: { ...systemInfo(), freeRamMb: Math.round(os.freemem() / MB) },
      reader,
      data: {
        databaseMb: fs.existsSync(dbFile) ? Math.round(fs.statSync(dbFile).size / MB) : 0,
        uploads: await folderSize(path.join(dataDir, 'uploads')),
      },
      summary,
      apiNow: await apiSnapshot(apiBase),
      appNow: appProcesses(),
      timeline: entries,
      apiLogTail: redact(readTail(path.join(logsDir, 'api.log'), LOG_TAIL_BYTES)),
    };
    await fs.promises.writeFile(filePath, JSON.stringify(report, null, 2));
    await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Diagnostics saved',
      message: 'Diagnostics saved. Send this file to whoever is looking into it.',
      detail: [
        `Highest memory: ${summary.peakTotalMb} MB (window ${summary.peakWindowMb} MB, engine ${summary.peakApiMb} MB)`,
        `Lowest free memory on this PC: ${summary.lowestFreeSystemMb ?? '–'} MB`,
        summary.lastStartupMs?.windowLoaded
          ? `Last start-up: ${(summary.lastStartupMs.windowLoaded / 1000).toFixed(1)} s`
          : null,
        'Emails, phone numbers and keys are hidden in the log.',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    shell.showItemInFolder(filePath);
  } catch (error) {
    dialog.showErrorBox('MG-ATS', `Couldn’t save diagnostics. ${error.message}`);
  }
}

module.exports = { mark, recordEvent, startRecorder, exportDiagnostics, rotateIfLarge };
