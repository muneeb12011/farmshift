/**
 * Generates secrets and writes env files so nothing needs hand-editing.
 *   npm run init                          dev: fills blank JWT_SECRET / METRICS_TOKEN in farmshift-backend/.env
 *   npm run init:prod -- farmshift.com    prod: creates .env.production (domain + fresh secrets)
 * Existing non-blank values are never overwritten. Secrets are never printed.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './_lib.mjs';

const secret = (n = 48) => randomBytes(n).toString('base64url');

export function fillBlank(text, values) {
  let out = text;
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k}=\\s*$`, 'm');
    if (re.test(out)) out = out.replace(re, `${k}=${v}`);
    else if (!new RegExp(`^${k}=`, 'm').test(out)) out += `${out.endsWith('\n') ? '' : '\n'}${k}=${v}\n`;
  }
  return out;
}

const prod = process.argv.includes('--prod');
const domain = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (prod) {
  const target = join(root, '.env.production');
  const base = existsSync(target) ? readFileSync(target, 'utf8') : readFileSync(join(root, '.env.production.example'), 'utf8');
  let next = fillBlank(base, { JWT_SECRET: secret(), METRICS_TOKEN: secret(24), POSTGRES_PASSWORD: secret(24) });
  if (domain) {
    next = next.replace(/^DOMAIN=.*$/m, `DOMAIN=${domain}`).replace(/^APP_URL=.*$/m, `APP_URL=https://${domain}`).replace(/^(MAIL_FROM=FarmShift <no-reply@).*$/m, `$1${domain}>`);
  }
  writeFileSync(target, next, { mode: 0o600 });
  console.log(`Wrote ${target}  (domain: ${domain ?? 'edit DOMAIN in the file'}; JWT_SECRET and METRICS_TOKEN generated).`);
  console.log('Next: add SMTP_URL (password-reset email) and optionally ANTHROPIC_API_KEY to that file, then: docker compose --env-file .env.production up -d --build');
} else {
  const target = join(root, 'farmshift-backend', '.env');
  const base = existsSync(target) ? readFileSync(target, 'utf8') : readFileSync(join(root, 'farmshift-backend', '.env.example'), 'utf8');
  writeFileSync(target, fillBlank(base, { JWT_SECRET: secret(), METRICS_TOKEN: secret(24) }), { mode: 0o600 });
  console.log(`Updated ${target}: JWT_SECRET and METRICS_TOKEN filled in (existing values kept).`);
}
