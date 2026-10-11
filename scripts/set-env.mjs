/**
 * Set keys in an env file without editing by hand and without echoing values.
 *   npm run set-key -- ANTHROPIC_API_KEY=sk-ant-...                 (dev: farmshift-backend/.env)
 *   npm run set-key -- --prod ANTHROPIC_API_KEY=sk-ant-...          (prod: .env.production)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './_lib.mjs';

export function setKeys(text, pairs) {
  let out = text;
  for (const [k, v] of pairs) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    out = re.test(out) ? out.replace(re, () => `${k}=${v}`) : `${out}${out.endsWith('\n') || out === '' ? '' : '\n'}${k}=${v}\n`;
  }
  return out;
}

const args = process.argv.slice(2);
const prod = args.includes('--prod');
const pairs = args.filter((a) => a.includes('=')).map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]);
if (!pairs.length || pairs.some(([k]) => !/^[A-Z][A-Z0-9_]*$/.test(k))) {
  console.error('Usage: npm run set-key -- [--prod] KEY=value [KEY2=value2]');
  process.exit(1);
}
const target = prod ? join(root, '.env.production') : join(root, 'farmshift-backend', '.env');
if (!existsSync(target)) {
  console.error(`${target} does not exist yet. Run: npm run ${prod ? 'init:prod -- your.domain.com' : 'init'}`);
  process.exit(1);
}
writeFileSync(target, setKeys(readFileSync(target, 'utf8'), pairs), { mode: 0o600 });
console.log(`Updated ${pairs.map(([k]) => k).join(', ')} in ${target}`);
