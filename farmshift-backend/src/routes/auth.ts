import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../lib/crypto.js';
import { resetEmail } from '../services/mailer.js';
import { AppError } from '../lib/errors.js';
import { clearSessionCookie, requireUserId, setSessionCookie, wantsCookieOnly } from '../plugins/auth.js';
import { toPublicUser } from '../repos/users.js';
import type { Services } from '../services/container.js';

const UserOut = z.object({ id: z.string(), email: z.string(), name: z.string(), createdAt: z.string() });
// `token` is omitted for browser clients that send `x-auth-mode: cookie` (they authenticate via the httpOnly cookie only).
const AuthOut = z.object({ user: UserOut, token: z.string().optional(), tokenType: z.literal('Bearer') });

const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

export async function authRoutes(app: FastifyInstance, svc: Services) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post(
    '/auth/register',
    {
      config: strictLimit,
      schema: {
        tags: ['auth'],
        summary: 'Create an account',
        body: z.object({ email: z.email().max(254), password: z.string().min(8).max(128), name: z.string().trim().min(1).max(80) }),
        response: { 201: AuthOut },
      },
    },
    async (req, reply) => {
      const user = await svc.users.create(req.body.email, req.body.name, await hashPassword(req.body.password));
      const token = app.jwt.sign({ sub: user.id, email: user.email, tv: user.tokenVersion });
      setSessionCookie(reply, svc.env, token);
      return reply.status(201).send({ user: toPublicUser(user), ...(wantsCookieOnly(req) ? {} : { token }), tokenType: 'Bearer' as const });
    },
  );

  r.post(
    '/auth/login',
    {
      config: strictLimit,
      schema: { tags: ['auth'], summary: 'Exchange credentials for a bearer token', body: z.object({ email: z.email(), password: z.string().min(1).max(128) }), response: { 200: AuthOut } },
    },
    async (req, reply) => {
      const user = await svc.users.findByEmail(req.body.email);
      // Always run one scrypt verification so response time does not reveal whether the email exists.
      const ok = await verifyPassword(req.body.password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !ok) throw AppError.unauthorized('Invalid email or password');
      const token = app.jwt.sign({ sub: user.id, email: user.email, tv: user.tokenVersion });
      setSessionCookie(reply, svc.env, token);
      return { user: toPublicUser(user), ...(wantsCookieOnly(req) ? {} : { token }), tokenType: 'Bearer' as const };
    },
  );

  r.get('/auth/me', { onRequest: [app.authenticate], schema: { tags: ['auth'], summary: 'Current user', security: [{ bearer: [] }], response: { 200: UserOut } } }, async (req) => {
    const user = await svc.users.findById(requireUserId(req));
    if (!user) throw AppError.unauthorized('Account no longer exists');
    return toPublicUser(user);
  });

  r.post(
    '/auth/logout',
    { schema: { tags: ['auth'], summary: 'Sign out this browser (clears the session cookie; other devices stay signed in)', response: { 204: z.null() } } },
    async (_req, reply) => {
      clearSessionCookie(reply, svc.env);
      return reply.status(204).send(null);
    },
  );

  r.post(
    '/auth/logout-all',
    { onRequest: [app.authenticate], schema: { tags: ['auth'], summary: 'Revoke every token issued to you (all devices)', security: [{ bearer: [] }], response: { 204: z.null() } } },
    async (req, reply) => {
      await svc.users.bumpTokenVersion(requireUserId(req));
      clearSessionCookie(reply, svc.env);
      return reply.status(204).send(null);
    },
  );

  r.post(
    '/auth/change-password',
    {
      config: strictLimit,
      onRequest: [app.authenticate],
      schema: {
        tags: ['auth'],
        summary: 'Change password; revokes all other sessions and returns a fresh token',
        security: [{ bearer: [] }],
        body: z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) }),
        response: { 200: AuthOut },
      },
    },
    async (req, reply) => {
      const user = await svc.users.findById(requireUserId(req));
      if (!user || !(await verifyPassword(req.body.currentPassword, user.passwordHash))) throw AppError.unauthorized('Current password is incorrect');
      const tv = await svc.users.updatePassword(user.id, await hashPassword(req.body.newPassword));
      const fresh = (await svc.users.findById(user.id))!;
      const token = app.jwt.sign({ sub: fresh.id, email: fresh.email, tv });
      setSessionCookie(reply, svc.env, token);
      return { user: toPublicUser(fresh), ...(wantsCookieOnly(req) ? {} : { token }), tokenType: 'Bearer' as const };
    },
  );

  // ---- password reset by email ----
  const sha256 = (x: string) => createHash('sha256').update(x).digest('hex');
  const resetLimit = { rateLimit: { max: 5, timeWindow: '1 minute' } };

  r.post(
    '/auth/forgot-password',
    {
      config: resetLimit,
      schema: {
        tags: ['auth'],
        summary: 'Email a one-time password-reset link. Always answers 202, whether or not the address has an account.',
        body: z.object({ email: z.email().max(254) }),
        response: { 202: z.object({ message: z.string() }) },
      },
    },
    async (req, reply) => {
      const user = await svc.users.findByEmail(req.body.email);
      // At most one email per account per minute (stops the endpoint being used to spam someone's inbox).
      if (user && !(await svc.resets.recentlyIssued(user.id, 60_000))) {
        const token = randomBytes(32).toString('base64url');
        await svc.resets.create(user.id, sha256(token), svc.env.RESET_TOKEN_TTL_MINUTES * 60_000);
        const link = `${svc.env.APP_URL.replace(/\/$/, '')}/reset-password?token=${token}`;
        const mail = resetEmail(link, svc.env.RESET_TOKEN_TTL_MINUTES, user.name);
        // Not awaited: response time must not reveal whether the account exists, and SMTP can be slow.
        void svc.mailer.send({ to: user.email, ...mail }).catch((err) => req.log.error({ err }, 'failed to send password reset email'));
      }
      return reply.status(202).send({ message: 'If an account exists for that address, a reset link has been sent.' });
    },
  );

  r.post(
    '/auth/reset-password',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        summary: 'Set a new password using a reset link token. Revokes every existing session.',
        body: z.object({ token: z.string().min(20).max(200), newPassword: z.string().min(8).max(128) }),
        response: { 204: z.null() },
      },
    },
    async (req, reply) => {
      const invalid = () => AppError.validation('This reset link is invalid or has expired. Request a new one.');
      const row = await svc.resets.findUsable(sha256(req.body.token));
      if (!row) throw invalid();
      if (!(await svc.resets.consume(row.id))) throw invalid(); // lost a race with another use of the same link
      await svc.users.updatePassword(row.userId, await hashPassword(req.body.newPassword)); // bumps token version: all sessions end
      await svc.resets.invalidateAllForUser(row.userId);
      clearSessionCookie(reply, svc.env);
      return reply.status(204).send(null);
    },
  );
}
