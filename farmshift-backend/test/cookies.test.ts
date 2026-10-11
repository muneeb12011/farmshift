import { describe, expect, it } from 'vitest';
import { durationSeconds } from '../src/plugins/auth.js';
import { testApp } from './helpers.js';

const J = { 'content-type': 'application/json' };
type App = Awaited<ReturnType<typeof testApp>>['app'];

async function login(app: App, email = 'cookie@example.com', headers: Record<string, string> = {}) {
  await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: J, payload: { email, password: 'correct horse battery', name: 'C' } });
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { ...J, ...headers }, payload: { email, password: 'correct horse battery' } });
  const cookie = res.cookies.find((c) => c.name === 'fs_session');
  return { res, cookie, header: { cookie: `fs_session=${cookie?.value ?? ''}` } };
}

describe('session cookie', () => {
  it('login sets an HttpOnly, SameSite=Lax, path=/ cookie lasting JWT_EXPIRES_IN (not Secure outside production)', async () => {
    const { app } = await testApp();
    const { cookie } = await login(app);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 7 * 86_400 });
    expect(cookie!.secure).toBeFalsy();
  });
  it('is Secure in production', async () => {
    const { app } = await testApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example' });
    const { cookie } = await login(app);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax' });
  });
  it('cookie-only mode (x-auth-mode: cookie) keeps the token out of the JSON body; default clients still get it', async () => {
    const { app } = await testApp();
    const web = await login(app, 'web@example.com', { 'x-auth-mode': 'cookie' });
    expect(web.res.json().token).toBeUndefined();
    expect(web.cookie).toBeDefined();
    const api = await login(app, 'api@example.com');
    expect(api.res.json().token).toEqual(expect.any(String));
    // register honours the same switch
    const reg = await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: { ...J, 'x-auth-mode': 'cookie' }, payload: { email: 'r@example.com', password: 'correct horse battery', name: 'R' } });
    expect(reg.json().token).toBeUndefined();
    expect(reg.cookies.some((c) => c.name === 'fs_session')).toBe(true);
  });
  it('authenticates requests from the cookie alone', async () => {
    const { app } = await testApp();
    const { header } = await login(app);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: header })).json().email).toBe('cookie@example.com');
  });
});

describe('CSRF defence for cookie-authenticated writes', () => {
  const create = (app: App, headers: Record<string, string>) => app.inject({ method: 'POST', url: '/api/v1/plans', headers: { ...J, ...headers }, payload: { name: 'p', crops: ['wheat'] } });

  it('blocks missing and foreign Origins; allows a listed Origin; GET needs no Origin', async () => {
    const { app } = await testApp({ NODE_ENV: 'development', CORS_ORIGINS: 'http://localhost:3000' });
    const { header } = await login(app);
    expect((await create(app, header)).statusCode).toBe(403);
    expect((await create(app, { ...header, origin: 'https://evil.example' })).statusCode).toBe(403);
    expect((await create(app, { ...header, origin: 'http://localhost.evil.example' })).statusCode).toBe(403);
    expect((await create(app, { ...header, origin: 'http://localhost:3000' })).statusCode).toBe(201);
    expect((await create(app, { ...header, origin: 'http://localhost:3999' })).statusCode).toBe(201); // dev: any localhost port
    expect((await app.inject({ method: 'GET', url: '/api/v1/plans', headers: header })).statusCode).toBe(200);
  });
  it('production accepts only CORS_ORIGINS (no localhost wildcard)', async () => {
    const { app } = await testApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example' });
    const { header } = await login(app);
    expect((await create(app, { ...header, origin: 'http://localhost:3000' })).statusCode).toBe(403);
    expect((await create(app, { ...header, origin: 'https://app.example' })).statusCode).toBe(201);
  });
  it('bearer-authenticated API clients are unaffected (no cookie, no Origin needed)', async () => {
    const { app } = await testApp();
    const { res } = await login(app);
    expect((await create(app, { authorization: `Bearer ${res.json().token}` })).statusCode).toBe(201);
  });
  it('CORS preflight allows credentials for an allowed origin only', async () => {
    const { app } = await testApp({ NODE_ENV: 'development' });
    const ok = await app.inject({ method: 'OPTIONS', url: '/api/v1/plans', headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'POST' } });
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    const bad = await app.inject({ method: 'OPTIONS', url: '/api/v1/plans', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('bad or revoked sessions never break public pages', () => {
  const cleared = (res: { cookies: { name: string; value: string; maxAge?: number; expires?: Date }[] }) =>
    res.cookies.some((c) => c.name === 'fs_session' && c.value === '' && (c.maxAge === 0 || (c.expires && c.expires.getTime() < Date.now() + 1000)));

  it('garbage cookie: public endpoint still 200 and the cookie is cleared; protected endpoint 401 and cleared', async () => {
    const { app } = await testApp();
    const bad = { cookie: 'fs_session=not.a.jwt' };
    const pub = await app.inject({ method: 'GET', url: '/api/v1/farms', headers: bad });
    expect(pub.statusCode).toBe(200);
    expect(cleared(pub)).toBe(true);
    const prot = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: bad });
    expect(prot.statusCode).toBe(401);
    expect(cleared(prot)).toBe(true);
  });
  it('after logout-all the old cookie is treated as anonymous and cleared', async () => {
    const { app } = await testApp();
    const { header } = await login(app);
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout-all', headers: { ...header, origin: 'http://localhost:3000' } });
    expect(out.statusCode).toBe(204);
    expect(cleared(out)).toBe(true);
    const farms = await app.inject({ method: 'GET', url: '/api/v1/farms', headers: header });
    expect(farms.statusCode).toBe(200);
    expect(cleared(farms)).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: header })).statusCode).toBe(401);
  });
  it('an explicit bearer wins over the cookie: bad bearer + good cookie is 401, good bearer + bad cookie is fine', async () => {
    const { app } = await testApp();
    const { header, res } = await login(app);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { ...header, authorization: 'Bearer junk' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: 'fs_session=junk', authorization: `Bearer ${res.json().token}` } })).statusCode).toBe(200);
  });
  it('logout clears the cookie for this browser without revoking other sessions', async () => {
    const { app } = await testApp();
    const a = await login(app);
    const out = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: J });
    expect(out.statusCode).toBe(204);
    expect(cleared(out)).toBe(true);
    // the previously issued token still works (only logout-all revokes)
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: a.header })).statusCode).toBe(200);
  });
  it('change-password re-issues a fresh cookie', async () => {
    const { app } = await testApp();
    const { header } = await login(app);
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/change-password', headers: { ...J, ...header, origin: 'http://localhost:3000' }, payload: { currentPassword: 'correct horse battery', newPassword: 'brand new password' } });
    expect(res.statusCode).toBe(200);
    const fresh = res.cookies.find((c) => c.name === 'fs_session')!;
    expect(fresh.value).not.toBe(header.cookie.split('=')[1]);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: header })).statusCode).toBe(401); // old cookie revoked
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: `fs_session=${fresh.value}` } })).statusCode).toBe(200);
  });
});

describe('durationSeconds', () => {
  it('parses units and falls back safely', () => {
    expect([durationSeconds('7d'), durationSeconds('12h'), durationSeconds('30m'), durationSeconds('90s'), durationSeconds('3600')]).toEqual([604_800, 43_200, 1_800, 90, 3_600]);
    expect(durationSeconds('forever')).toBe(604_800);
  });
});
