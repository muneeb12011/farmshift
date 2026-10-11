import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const api = join(root, 'farmshift-backend');
export const web = join(root, 'farmshift');

export function requireNode() {
  const [maj, min] = process.versions.node.split('.').map(Number);
  if (maj < 22 || (maj === 22 && min < 13)) {
    console.error(
      `\nNode ${process.versions.node} is too old. The backend uses Node's built-in SQLite and needs Node >= 22.13.\n` +
        `Install the current LTS from https://nodejs.org (or: nvm install 22 && nvm use 22), then re-run.\n`,
    );
    process.exit(1);
  }
}

export const installed = (dir) => existsSync(join(dir, 'node_modules'));

export function run(cmd, args, cwd, label, color) {
  const child = spawn(cmd, args, { cwd, shell: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const tag = `\x1b[${color}m[${label}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (d) =>
      String(d)
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => out.write(tag + line + '\n')),
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

export function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid);
    } catch {
      child.kill();
    }
  }
}
