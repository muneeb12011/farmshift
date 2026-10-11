import type { SqlAdapter } from '../db/adapter.js';

export interface CacheEntry {
  key: string;
  payload: string;
  source: string;
  fetchedAt: number;
  expiresAt: number;
}

const map = (r: Record<string, unknown>): CacheEntry => ({
  key: r.key as string,
  payload: r.payload as string,
  source: r.source as string,
  fetchedAt: Number(r.fetched_at),
  expiresAt: Number(r.expires_at),
});

export class CacheRepo {
  constructor(private db: SqlAdapter) {}

  async get(key: string): Promise<CacheEntry | undefined> {
    const r = await this.db.get('SELECT * FROM env_cache WHERE key = ?', [key]);
    return r ? map(r) : undefined;
  }

  /** Newest entry sharing `prefix`, expired or not: the stale-while-error fallback. */
  async latestByPrefix(prefix: string): Promise<CacheEntry | undefined> {
    const r = await this.db.get('SELECT * FROM env_cache WHERE prefix = ? ORDER BY fetched_at DESC LIMIT 1', [prefix]);
    return r ? map(r) : undefined;
  }

  async put(entry: { key: string; prefix: string; payload: string; source: string; ttlMs: number }): Promise<void> {
    const now = Date.now();
    await this.db.run(
      `INSERT INTO env_cache (key, prefix, payload, source, fetched_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, source = excluded.source,
         fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`,
      [entry.key, entry.prefix, entry.payload, entry.source, now, now + entry.ttlMs],
    );
    // Keep the table small: retain the 3 newest entries per location prefix.
    await this.db.run(
      `DELETE FROM env_cache WHERE prefix = ? AND key NOT IN
         (SELECT key FROM env_cache WHERE prefix = ? ORDER BY fetched_at DESC LIMIT 3)`,
      [entry.prefix, entry.prefix],
    );
  }

  async purgeExpiredOlderThan(ms: number): Promise<number> {
    return (await this.db.run('DELETE FROM env_cache WHERE expires_at < ?', [Date.now() - ms])).changes;
  }
}
