import type { Env } from '../config/env.js';

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Explicit allow-list from CORS_ORIGINS. Outside production any localhost port is also accepted, because
 * `next dev` silently moves to :3001 when :3000 is busy and the API would otherwise reject the browser.
 */
export function isAllowedOrigin(env: Pick<Env, 'CORS_ORIGINS' | 'NODE_ENV'>, origin: string): boolean {
  const list = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  return list.includes(origin) || (env.NODE_ENV !== 'production' && LOCALHOST_ORIGIN.test(origin));
}
