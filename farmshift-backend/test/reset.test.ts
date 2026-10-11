import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { LogMailer, NullMailer, SmtpMailer, createMailer, type Mail, type Mailer } from '../src/services/mailer.js';
import { makeEnv, registerUser, testApp } from './helpers.js';

const J = { 'content-type': 'application/json' };

class CaptureMailer implements Mailer {
  readonly kind = 'smtp' as const;
  sent: Mail[] = [];
  failWith?: Error;
  async send(m: Mail) {
    if (this.failWith) throw this.failWith;
    this.sent.push(m);
  }
  tokenOf(i = this.sent.length - 1) {
    return /reset-password\?token=([A-Za-z0-9_-]+)/.exec(this.sent[i]!.text)![1]!;
  }
}

const boot = async (env: Record<string, string> = {}) => {
  const mailer = new CaptureMailer();
  const built = await testApp(env, { mailer });
  const user = await registerUser(built.app, 'ada@example.com', 'Ada');
  const forgot = (email: string) => built.app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', headers: J, payload: { email } });
  const reset = (token: string, newPassword = 'brand new password') => built.app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', headers: J, payload: { token, newPassword } });
  const login = (password: string) => built.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'ada@example.com', password } });
  const settle = () => new Promise((r) => setTimeout(r, 25)); // the email send is intentionally fire-and-forget
  return { ...built, mailer, user, forgot, reset, login, settle };
};

describe('forgot-password', () => {
  it('answers identically for known and unknown addresses, and only emails real accounts', async () => {
    const t = await boot();
    const known = await t.forgot('ADA@example.com');
    const unknown = await t.forgot('nobody@example.com');
    await t.settle();
    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(unknown.json()).toEqual(known.json());
    expect(t.mailer.sent).toHaveLength(1);
    expect(t.mailer.sent[0]).toMatchObject({ to: 'ada@example.com', subject: 'Reset your FarmShift password' });
    expect(t.mailer.sent[0]!.text).toMatch(/^Hi Ada,/);
    expect(t.mailer.sent[0]!.text).toContain('http://localhost:3000/reset-password?token=');
    expect(t.mailer.sent[0]!.html).toContain('<a href="http://localhost:3000/reset-password?token=');
  });
  it('stores only a hash of the token', async () => {
    const t = await boot();
    await t.forgot('ada@example.com');
    await t.settle();
    const token = t.mailer.tokenOf();
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 random bytes
    const rows = await t.services.sql.all<{ token_hash: string }>('SELECT token_hash FROM password_resets');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(token);
  });
  it('sends at most one email per account per minute', async () => {
    const t = await boot();
    await t.forgot('ada@example.com');
    await t.forgot('ada@example.com');
    await t.forgot('ada@example.com');
    await t.settle();
    expect(t.mailer.sent).toHaveLength(1);
  });
  it('a failing mail server never changes the response (no information leak) and is not retried in-band', async () => {
    const t = await boot();
    t.mailer.failWith = new Error('SMTP down');
    const res = await t.forgot('ada@example.com');
    await t.settle();
    expect(res.statusCode).toBe(202);
  });
  it('validates input and is rate limited', async () => {
    const t = await boot({ RATE_LIMIT_MAX: '100000' });
    expect((await t.forgot('not-an-email')).statusCode).toBe(400);
    let last = 0;
    for (let i = 0; i < 8; i++) last = (await t.forgot(`u${i}@example.com`)).statusCode;
    expect(last).toBe(429);
  });
});

describe('reset-password', () => {
  it('sets the new password, ends every existing session (bearer and cookie), and the link works only once', async () => {
    const t = await boot();
    const cookieLogin = await t.login('correct horse battery');
    const cookie = { cookie: `fs_session=${cookieLogin.cookies[0]!.value}` };
    await t.forgot('ada@example.com');
    await t.settle();
    const token = t.mailer.tokenOf();

    const ok = await t.reset(token);
    expect(ok.statusCode).toBe(204);
    expect((await t.login('correct horse battery')).statusCode).toBe(401);
    expect((await t.login('brand new password')).statusCode).toBe(200);
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: t.user.auth })).statusCode).toBe(401);
    expect((await t.app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: cookie })).statusCode).toBe(401);

    const again = await t.reset(token, 'another new password');
    expect(again.statusCode).toBe(400);
    expect(again.json().error.message).toMatch(/invalid or has expired/);
    expect((await t.login('brand new password')).statusCode).toBe(200); // unchanged by the replay
  });
  it('rejects expired, unknown, and malformed tokens with the same generic message', async () => {
    const t = await boot();
    await t.forgot('ada@example.com');
    await t.settle();
    const token = t.mailer.tokenOf();
    await t.services.sql.run('UPDATE password_resets SET expires_at = ?', [Date.now() - 1000]);
    const expired = await t.reset(token);
    const unknown = await t.reset('x'.repeat(43));
    expect(expired.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(400);
    expect(expired.json().error.message).toBe(unknown.json().error.message);
    expect((await t.reset('short')).statusCode).toBe(400);
    expect((await t.reset(token, 'short')).statusCode).toBe(400); // password policy still applies
    expect((await t.login('correct horse battery')).statusCode).toBe(200); // nothing changed
  });
  it('under concurrent use of one link exactly one request wins', async () => {
    const t = await boot();
    await t.forgot('ada@example.com');
    await t.settle();
    const token = t.mailer.tokenOf();
    const results = await Promise.all([1, 2, 3, 4].map((i) => t.reset(token, `winner password ${i}`)));
    expect(results.filter((r) => r.statusCode === 204)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 400)).toHaveLength(3);
  });
  it('a successful reset also burns other outstanding links for that user', async () => {
    const t = await boot();
    await t.forgot('ada@example.com');
    await t.settle();
    await t.services.sql.run('UPDATE password_resets SET created_at = ?', [Date.now() - 120_000]); // allow a second link
    await t.forgot('ada@example.com');
    await t.settle();
    expect(t.mailer.sent).toHaveLength(2);
    expect((await t.reset(t.mailer.tokenOf(0))).statusCode).toBe(204);
    expect((await t.reset(t.mailer.tokenOf(1), 'second link password')).statusCode).toBe(400);
  });
  it('honours RESET_TOKEN_TTL_MINUTES and APP_URL', async () => {
    const t = await boot({ RESET_TOKEN_TTL_MINUTES: '15', APP_URL: 'https://farm.example.com/' });
    await t.forgot('ada@example.com');
    await t.settle();
    expect(t.mailer.sent[0]!.text).toContain('https://farm.example.com/reset-password?token=');
    expect(t.mailer.sent[0]!.text).toContain('within 15 minutes');
    const row = (await t.services.sql.all<{ expires_at: number; created_at: number }>('SELECT * FROM password_resets'))[0]!;
    expect(Number(row.expires_at) - Number(row.created_at)).toBe(15 * 60_000);
  });
});

describe('mailer selection and SMTP delivery', () => {
  const log = { warn: () => {}, error: () => {} };
  it('picks SMTP when configured, log in development, and a loud no-op in production without SMTP', () => {
    expect(createMailer(makeEnv({ SMTP_URL: 'smtp://u:p@localhost:2525' }), log)).toBeInstanceOf(SmtpMailer);
    expect(createMailer(makeEnv({ NODE_ENV: 'development' }), log)).toBeInstanceOf(LogMailer);
    expect(createMailer(makeEnv({ NODE_ENV: 'production', CORS_ORIGINS: 'https://x.example' }), log)).toBeInstanceOf(NullMailer);
    expect(() => loadEnv({ SMTP_URL: 'http://wrong' } as NodeJS.ProcessEnv)).toThrow(/SMTP_URL/);
  });
  it('SmtpMailer hands a correctly formed message to the transport', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const m = new SmtpMailer(transport, 'FarmShift <no-reply@farm.example>');
    let out: { to: { address: string }[]; from: { address: string }; subject: string; text: string } | undefined;
    const orig = transport.sendMail.bind(transport);
    transport.sendMail = (async (opts: never) => {
      const info = (await orig(opts)) as { message: string };
      out = JSON.parse(info.message);
      return info;
    }) as never;
    await m.send({ to: 'ada@example.com', subject: 'Hello', text: 'link: https://x', html: '<b>x</b>' });
    expect(out!.to[0]!.address).toBe('ada@example.com');
    expect(out!.from.address).toBe('no-reply@farm.example');
    expect(out!.subject).toBe('Hello');
    expect(out!.text).toBe('link: https://x');
  });
  it('production without SMTP still returns 202 (and never claims delivery)', async () => {
    const built = await testApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://x.example' });
    await registerUser(built.app, 'ada@example.com');
    const res = await built.app.inject({ method: 'POST', url: '/api/v1/auth/forgot-password', headers: J, payload: { email: 'ada@example.com' } });
    expect(res.statusCode).toBe(202);
    expect(built.services.mailer.kind).toBe('none');
  });
});
