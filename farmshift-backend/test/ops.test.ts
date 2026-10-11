import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SqliteAdapter } from '../src/db/sqlite-adapter.js';
import { backupDatabase, pruneBackups } from '../src/db/backup.js';
import { fetchJson } from '../src/lib/http.js';
import { runMaintenance, warmDemoFarms } from '../src/services/maintenance.js';
import { USING_PG, fakeUpstream, registerUser, testApp } from './helpers.js';

const J = { 'content-type': 'application/json' };

describe('retention and maintenance', () => {
  it('deletes old anonymous runs and expired cache, keeps owned runs and fresh data', async () => {
    const { app, services } = await testApp();
    const user = await registerUser(app, 'keep@example.com');
    const gen = (headers = {}) => app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: { ...J, ...headers }, payload: { farmId: 'green-valley' } }).then((r) => r.json().runId as string);
    const anonOld = await gen();
    const anonNew = await gen();
    const owned = await gen(user.auth);
    const old = Date.now() - 40 * 86_400_000;
    await services.sql.run('UPDATE scenario_runs SET created_at = ? WHERE id IN (?, ?)', [old, anonOld, owned]);
    await services.cache.put({ key: 'k-old', prefix: 'p', payload: '{}', source: 's', ttlMs: 1 });
    await services.sql.run("UPDATE env_cache SET expires_at = ? WHERE key = 'k-old'", [Date.now() - 10 * 86_400_000]);

    const r = await runMaintenance(services);
    expect(r).toEqual({ anonymousRunsDeleted: 1, cacheEntriesDeleted: 1, resetTokensDeleted: 0 });
    expect((await app.inject(`/api/v1/runs/${anonOld}`)).statusCode).toBe(404);
    expect((await app.inject(`/api/v1/runs/${anonNew}`)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/v1/runs/${owned}`, headers: user.auth })).statusCode).toBe(200); // owned runs are never purged
  });
  it('warm-up prefetches every demo farm exactly once and swallows upstream failure', async () => {
    const up = fakeUpstream();
    const { services } = await testApp({ ENV_PROVIDER: 'auto', CLIMATE_YEARS: '2' }, { fetchImpl: up.fetch, retryBaseMs: 1 });
    const log = { info: () => {} };
    await warmDemoFarms(services, log);
    expect(up.calls.filter((c) => c.kind === 'nasa')).toHaveLength(4);
    await warmDemoFarms(services, log); // second pass is all cache hits
    expect(up.calls.filter((c) => c.kind === 'nasa')).toHaveLength(4);

    const down = fakeUpstream();
    down.failAll(true);
    const b = await testApp({ ENV_PROVIDER: 'auto', CLIMATE_YEARS: '2' }, { fetchImpl: down.fetch, retryBaseMs: 1 });
    await expect(warmDemoFarms(b.services, log)).resolves.toBeUndefined();
  });
  it('warm-up is skipped for the synthetic provider and when disabled', async () => {
    const up = fakeUpstream();
    const { services } = await testApp({ ENV_PROVIDER: 'auto', WARMUP_DEMO_FARMS: 'false' }, { fetchImpl: up.fetch });
    await warmDemoFarms(services, { info: () => {} });
    expect(up.calls).toHaveLength(0);
  });
});

describe('upstream deadline', () => {
  it('stops retrying when the total budget is spent', async () => {
    let calls = 0;
    const f = (async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return new Response('{}', { status: 503 });
    }) as typeof fetch;
    const t0 = Date.now();
    await expect(fetchJson('http://x', { timeoutMs: 1000, deadlineMs: 120, retries: 10, retryBaseMs: 40, label: 'slow', fetchImpl: f })).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(400);
    expect(calls).toBeLessThan(6);
  });
});

describe('metrics endpoint', () => {
  it('counts requests by route pattern (not raw URL) and exposes pipeline events', async () => {
    const up = fakeUpstream();
    const { app } = await testApp({ ENV_PROVIDER: 'auto', CLIMATE_YEARS: '2' }, { fetchImpl: up.fetch, retryBaseMs: 1 });
    await app.inject('/api/v1/farms/green-valley');
    await app.inject('/api/v1/farms/indus-basin');
    await app.inject('/api/v1/environment/summary?lat=30&lon=70');
    await app.inject('/api/v1/environment/summary?lat=30&lon=70');
    await app.inject('/nope');
    const text = (await app.inject('/metrics')).body;
    expect(text).toMatch(/http_requests_total\{method="GET",route="\/api\/v1\/farms\/:id",status="200"\} 2/);
    expect(text).toMatch(/route="unmatched",status="404"/);
    expect(text).toMatch(/environment_events_total\{event="upstream_ok"\} 1/);
    expect(text).toMatch(/environment_events_total\{event="cache_hit"\} 1/);
    expect(text).toMatch(/http_request_duration_seconds_count\{method="GET",route="\/api\/v1\/farms\/:id"\} 2/);
    expect(text).not.toMatch(/green-valley/); // no unbounded label values
  });
  it('requires the bearer token when configured; disabled in production without one', async () => {
    const tok = 'metrics-token-1234567890';
    const a = await testApp({ METRICS_TOKEN: tok });
    expect((await a.app.inject('/metrics')).statusCode).toBe(401);
    expect((await a.app.inject({ method: 'GET', url: '/metrics', headers: { authorization: 'Bearer wrong' } })).statusCode).toBe(401);
    expect((await a.app.inject({ method: 'GET', url: '/metrics', headers: { authorization: `Bearer ${tok}` } })).statusCode).toBe(200);
    const prod = await testApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://x.example' });
    expect((await prod.app.inject('/metrics')).statusCode).toBe(404);
  });
});

describe('sessions: logout-all and change-password revoke tokens', () => {
  it('logout-all invalidates every previously issued token; logging in again works', async () => {
    const { app } = await testApp();
    const a = await registerUser(app, 'sess@example.com');
    const login = (await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'sess@example.com', password: 'correct horse battery' } })).json();
    const other = { authorization: `Bearer ${login.token}` };
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: a.auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/logout-all', headers: a.auth })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: a.auth })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: other })).statusCode).toBe(401);
    // revoked tokens are rejected even on endpoints where login is optional
    expect((await app.inject({ method: 'GET', url: '/api/v1/farms', headers: a.auth })).statusCode).toBe(401);
    const fresh = (await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'sess@example.com', password: 'correct horse battery' } })).json();
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${fresh.token}` } })).statusCode).toBe(200);
  });
  it('change-password: wrong current password rejected; success revokes old tokens and returns a working one', async () => {
    const { app } = await testApp();
    const a = await registerUser(app, 'pw@example.com');
    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { ...J, ...a.auth }, payload: { currentPassword: 'nope nope nope', newPassword: 'brand new password' } });
    expect(bad.statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: a.auth })).statusCode).toBe(200); // failed attempt does not revoke
    const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { ...J, ...a.auth }, payload: { currentPassword: 'correct horse battery', newPassword: 'brand new password' } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: a.auth })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${ok.json().token}` } })).statusCode).toBe(200);
    const login = (pw: string) => app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'pw@example.com', password: pw } });
    expect((await login('correct horse battery')).statusCode).toBe(401);
    expect((await login('brand new password')).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { ...J, ...a.auth }, payload: { currentPassword: 'x', newPassword: 'short' } })).statusCode).toBe(401); // revoked token cannot be used again
  });
  it('a deleted account\'s token stops working', async () => {
    const { app, services } = await testApp();
    const a = await registerUser(app, 'gone@example.com');
    await services.sql.run('DELETE FROM users WHERE id = ?', [a.id]);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: a.auth })).statusCode).toBe(401);
  });
});

describe.skipIf(USING_PG)('database backup (SQLite)', () => {
  it('writes a consistent, openable snapshot containing live data; prune keeps the newest N', async () => {
    const { app, services } = await testApp();
    await registerUser(app, 'backup@example.com');
    const dir = mkdtempSync(join(tmpdir(), 'fsbak-'));
    const file = backupDatabase(services.db!, dir, new Date('2026-10-01T10:00:00Z'));
    expect(file).toMatch(/farmshift-20261001-100000\.db$/);
    const copy = SqliteAdapter.open(file);
    expect(await copy.migrate()).toEqual([]); // already at latest schema
    expect((await copy.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n).toBe(1);
    expect((await copy.get<{ n: number }>('SELECT COUNT(*) AS n FROM farms'))!.n).toBe(4);
    await copy.close();
    for (const d of ['2026-10-02', '2026-10-03', '2026-10-04']) backupDatabase(services.db!, dir, new Date(`${d}T10:00:00Z`));
    expect(pruneBackups(dir, 2)).toHaveLength(2);
    expect(readdirSync(dir).sort()).toEqual(['farmshift-20261003-100000.db', 'farmshift-20261004-100000.db']);
    expect(pruneBackups(dir, 0)).toHaveLength(1); // never deletes the last remaining backup
  });
});
