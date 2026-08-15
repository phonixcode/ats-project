const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const backend = path.join(repoRoot, 'backend');
const stage = path.join(__dirname, '..', '.pack', 'backend');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const dist = path.join(backend, 'dist');
if (!fs.existsSync(dist)) {
  fail('backend/dist is missing. Run: cd backend && npm run build');
}
if (!fs.existsSync(path.join(backend, 'node_modules'))) {
  fail('backend/node_modules is missing. Run: cd backend && npm ci');
}

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

fs.cpSync(dist, path.join(stage, 'dist'), { recursive: true });
fs.cpSync(path.join(backend, 'prisma'), path.join(stage, 'prisma'), { recursive: true });
fs.copyFileSync(path.join(backend, 'package.json'), path.join(stage, 'package.json'));
fs.copyFileSync(path.join(backend, 'package-lock.json'), path.join(stage, 'package-lock.json'));
fs.cpSync(path.join(backend, 'node_modules'), path.join(stage, 'node_modules'), {
  recursive: true,
});

run('npm', ['prune', '--omit=dev'], stage);

if (process.platform !== 'win32') {
  fail('pack:win must run on Windows so SQLite is built for the Windows app.');
}

const desktop = path.join(__dirname, '..');
const electronPkg = path.join(desktop, 'node_modules', 'electron', 'package.json');
if (!fs.existsSync(electronPkg)) {
  fail('desktop/node_modules/electron is missing. Run: cd desktop && npm ci');
}
const electronVersion = JSON.parse(fs.readFileSync(electronPkg, 'utf8')).version;
run(
  'npx',
  [
    'electron-rebuild',
    '--force',
    '--only',
    'better-sqlite3',
    '--version',
    electronVersion,
    '--module-dir',
    stage,
  ],
  desktop,
);
