import pg from 'pg';
import { UniqueViolation, type RunResult, type SqlAdapter } from './adapter.js';
import { PG_MIGRATIONS } from './pg-migrations.js';

// BIGINT (epoch-ms timestamps, COUNT(*)) comes back as a string by default; all our values fit in a double.
pg.types.setTypeParser(20, (v) => Number(v));

export interface PgOptions {
  url: string;
  max: number;
  ssl: boolean;
  schema: string;
}

/** Translate `?` placeholders to `$1..$n`, ignoring `?` inside single-quoted string literals. */
export function toPgPlaceholders(sql: string): string {
  let n = 0;
  let inStr = false;
  let out = '';
  for (const ch of sql) {
    if (ch === "'") inStr = !inStr;
    out += ch === '?' && !inStr ? `$${++n}` : ch;
  }
  return out;
}

export class PgAdapter implements SqlAdapter {
  readonly dialect = 'postgres' as const;
  private constructor(
    private readonly pool: pg.Pool,
    private readonly schema: string,
  ) {}

  static async connect(o: PgOptions): Promise<PgAdapter> {
    if (o.schema !== 'public') {
      const boot = new pg.Client({ connectionString: o.url, ssl: o.ssl ? { rejectUnauthorized: false } : undefined });
      await boot.connect();
      try {
        // CREATE SCHEMA IF NOT EXISTS is not safe when several instances start simultaneously; serialise it.
        await boot.query('SELECT pg_advisory_lock($1)', [727_000]);
        try {
          await boot.query(`CREATE SCHEMA IF NOT EXISTS ${o.schema}`);
        } finally {
          await boot.query('SELECT pg_advisory_unlock($1)', [727_000]).catch(() => undefined);
        }
      } finally {
        await boot.end();
      }
    }
    const pool = new pg.Pool({
      connectionString: o.url,
      max: o.max,
      ssl: o.ssl ? { rejectUnauthorized: false } : undefined,
      options: `-c search_path=${o.schema}`,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', () => {
      /* an idle client dropped (e.g. DB restart); the pool replaces it on next use */
    });
    return new PgAdapter(pool, o.schema);
  }

  private async exec<T extends pg.QueryResultRow>(sql: string, params: readonly unknown[]) {
    try {
      return await this.pool.query<T>(toPgPlaceholders(sql), params as unknown[]);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new UniqueViolation((e as Error).message);
      throw e;
    }
  }

  async all<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return (await this.exec(sql, params)).rows as T[];
  }
  async get<T>(sql: string, params: readonly unknown[] = []): Promise<T | undefined> {
    return (await this.exec(sql, params)).rows[0] as T | undefined;
  }
  async run(sql: string, params: readonly unknown[] = []): Promise<RunResult> {
    return { changes: (await this.exec(sql, params)).rowCount ?? 0 };
  }

  /** Migrations run in one transaction under a session advisory lock so concurrent instances cannot race. */
  async migrate(): Promise<string[]> {
    const client = await this.pool.connect();
    const applied: string[] = [];
    const LOCK = 727_001; // arbitrary app-wide key
    try {
      await client.query('SELECT pg_advisory_lock($1)', [LOCK]);
      await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at BIGINT NOT NULL)');
      const done = new Set((await client.query<{ version: number }>('SELECT version FROM schema_migrations')).rows.map((r) => Number(r.version)));
      for (const m of PG_MIGRATIONS) {
        if (done.has(m.version)) continue;
        await client.query('BEGIN');
        try {
          await client.query(m.sql);
          await client.query('INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)', [m.version, m.name, Date.now()]);
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        }
        applied.push(`${m.version}_${m.name}`);
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK]).catch(() => undefined);
      client.release();
    }
    return applied;
  }

  async housekeeping() {
    await this.pool.query('ANALYZE').catch(() => undefined);
  }
  async ping() {
    await this.pool.query('SELECT 1');
  }
  async close() {
    await this.pool.end();
  }

  /** Test helper: drop the whole schema. */
  async dropSchema() {
    await this.pool.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
  }
}
