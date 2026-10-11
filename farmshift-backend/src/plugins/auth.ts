import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import type { Env } from '../config/env.js';
import { DEV_JWT_SECRET } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { isAllowedOrigin } from '../lib/origins.js';
import type { UsersRepo } from '../repos/users.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; tv: number };
    user: { sub: string; email: string; tv: number };
  }
}
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    /** Where the credential came from: an explicit bearer token (API clients) or the httpOnly session cookie (browsers). */
    authSource?: 'bearer' | 'cookie';
  }
}

export const SESSION_COOKIE = 'fs_session';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** "7d" / "12h" / "30m" / "3600s" / "3600" → seconds (defaults to 7 days when unparseable). */
export function durationSeconds(v: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(v.trim());
  if (!m) return 7 * 86_400;
  return Number(m[1]) * { '': 1, s: 1, m: 60, h: 3600, d: 86_400 }[m[2] as '' | 's' | 'm' | 'h' | 'd'];
}

export function setSessionCookie(reply: FastifyReply, env: Env, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true, // never readable from JavaScript (XSS cannot steal it)
    secure: env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // not sent on cross-site POST/PUT/DELETE
    path: '/',
    maxAge: durationSeconds(env.JWT_EXPIRES_IN),
  });
}

export function clearSessionCookie(reply: FastifyReply, env: Env) {
  reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax' });
}

/** Browser clients that send `x-auth-mode: cookie` get the session only as an httpOnly cookie, never in the JSON body. */
export const wantsCookieOnly = (req: FastifyRequest) => req.headers['x-auth-mode'] === 'cookie';

export async function registerAuth(app: FastifyInstance, env: Env, users: UsersRepo) {
  await app.register(jwt, {
    secret: env.JWT_SECRET ?? DEV_JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });

  type Outcome = { kind: 'none' } | { kind: 'ok' } | { kind: 'invalid'; source: 'bearer' | 'cookie' };

  /**
   * Credential resolution: an explicit Authorization bearer wins; otherwise the session cookie.
   * Cookie-authenticated unsafe requests must carry an allowed Origin (CSRF defence in depth on top of SameSite=Lax).
   */
  const resolve = async (req: FastifyRequest): Promise<Outcome> => {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const cookieToken = req.cookies?.[SESSION_COOKIE];
    const token = bearer ?? cookieToken;
    if (!token) return { kind: 'none' };
    const source: 'bearer' | 'cookie' = bearer ? 'bearer' : 'cookie';
    if (source === 'cookie' && !SAFE_METHODS.has(req.method)) {
      const origin = req.headers.origin;
      if (!origin || !isAllowedOrigin(env, origin)) throw AppError.forbidden('Cross-site request blocked');
    }
    try {
      const payload = app.jwt.verify<{ sub: string; email: string; tv: number }>(token);
      const u = await users.findById(payload.sub);
      if (!u || u.tokenVersion !== payload.tv) return { kind: 'invalid', source };
      (req as { user?: unknown }).user = payload;
      req.authSource = source;
      return { kind: 'ok' };
    } catch {
      return { kind: 'invalid', source };
    }
  };

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const o = await resolve(req);
    if (o.kind === 'ok') return;
    if (o.kind === 'invalid' && o.source === 'cookie') clearSessionCookie(reply, env);
    throw AppError.unauthorized(o.kind === 'none' ? 'Authentication required' : 'Missing, invalid or revoked session');
  });

  // Anonymous access is allowed. A bad *bearer* token is an error (the client sent it deliberately);
  // a bad *cookie* is silently dropped so an expired session can never break a public page.
  app.decorate('optionalAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    const o = await resolve(req);
    if (o.kind === 'invalid') {
      if (o.source === 'cookie') clearSessionCookie(reply, env);
      else throw AppError.unauthorized('Invalid or revoked bearer token');
    }
  });
}

/** Current user id if authenticated (after authenticate/optionalAuth), else undefined. */
export const userIdOf = (req: FastifyRequest): string | undefined => (req as unknown as { user?: { sub: string } }).user?.sub;

export const requireUserId = (req: FastifyRequest): string => {
  const id = userIdOf(req);
  if (!id) throw AppError.unauthorized();
  return id;
};
