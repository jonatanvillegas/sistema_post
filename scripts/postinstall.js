import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..');
const initCwdRaw = process.env.INIT_CWD;
const initCwd = initCwdRaw ? path.resolve(initCwdRaw) : null;

const samePath = (a, b) => {
  if (!a || !b) return false;
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
};

// When this package is installed as a dependency (e.g. via "file:../.."),
// npm sets INIT_CWD to the caller's directory. In that scenario we must not
// run nested installs, otherwise it can recurse infinitely.
if (!samePath(initCwd, repoRoot)) {
  console.log('[postinstall] Skipping nested installs (dependency install).');
  process.exit(0);
}

const run = (cwd, args) => {
  console.log(`[postinstall] npm ${args.join(' ')} (cwd: ${cwd})`);
  const result = spawnSync('npm', args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(path.join(repoRoot, 'backend'), ['install']);
run(path.join(repoRoot, 'front', 'sistema-pos-front'), ['install']);
