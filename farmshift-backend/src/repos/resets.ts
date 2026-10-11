import type { SqlAdapter } from '../db/adapter.js';
import { newId } from '../lib/ids.js';

export interface ResetRow {
  id: string;
  userId: string;
  expiresAt: number;
  usedAt: number | null;
  createdAt: number;
}

const map = (r: Record<string, unknown>): ResetRow => ({
  id: r.id as string,
  userId: r.user_id as string,
  expiresAt: Number(r.expires_at),
  usedAt: r.used_at === null || r.used_at === undefined ? null : Number(r.used_at),
  createdAt: Number(r.created_at),
});

/** Only SHA-256 hashes of reset tokens are stored; a database leak does not yield usable links. */
export class ResetsRepo {
  constructor(private db: SqlAdapter) {}

  async create(userId: string, tokenHash: string, ttlMs: number): Promise<void> {
    const now = Date.now();
    await this.db.run('INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)', [newId('rst'), userId, tokenHash, now + ttlMs, now]);
  }

  async findUsable(tokenHash: string): Promise<ResetRow | undefined> {
    const r = await this.db.get('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', [tokenHash, Date.now()]);
    return r ? map(r) : undefined;
  }

  /** Atomically claim a reset: true for exactly one caller even under concurrent requests. */
  async consume(id: string): Promise<boolean> {
    return (await this.db.run('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL', [Date.now(), id])).changes === 1;
  }

  /** Burn every other outstanding link for the user (after a successful reset). */
  async invalidateAllForUser(userId: string): Promise<void> {
    await this.db.run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [Date.now(), userId]);
  }

  async recentlyIssued(userId: string, withinMs: number): Promise<boolean> {
    const r = await this.db.get('SELECT 1 AS x FROM password_resets WHERE user_id = ? AND created_at > ? LIMIT 1', [userId, Date.now() - withinMs]);
    return !!r;
  }

  async purgeOlderThan(ms: number): Promise<number> {
    return (await this.db.run('DELETE FROM password_resets WHERE expires_at < ?', [Date.now() - ms])).changes;
  }
}
