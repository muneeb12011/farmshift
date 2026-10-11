import { api, web, requireNode, run } from './_lib.mjs';

requireNode();
const install = (dir, label, color) =>
  new Promise((resolve, reject) => {
    const c = run('npm', ['install', '--no-audit', '--no-fund'], dir, label, color);
    c.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} install failed (${code})`))));
  });

await install(api, 'api', '36');
await install(web, 'web', '35');
console.log('\nDone. Start everything with:  npm run dev\n');
