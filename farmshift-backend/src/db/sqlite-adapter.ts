import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { UniqueViolation, type RunResult, type SqlAdapter } from './adapter.js';
import { MIGRATIONS } from './migrations.js';

export type Db = DatabaseSync;

export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }
  return db;
}

/** Run `fn` inside an immediate transaction; rolls back on throw. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function migrateSqlite(db: Db): { applied: string[] } {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    transaction(db, () => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, Date.now());
    });
    applied.push(`${m.version}_${m.name}`);
  }
  return { applied };
}

export class SqliteAdapter implements SqlAdapter {
  readonly dialect = 'sqlite' as const;
  constructor(public readonly raw: Db) {}

  static open(path: string): SqliteAdapter {
    return new SqliteAdapter(openDatabase(path));
  }

  private wrap<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if (/UNIQUE constraint failed/i.test(String((e as Error).message))) throw new UniqueViolation((e as Error).message);
      throw e;
    }
  }

  async all<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return this.wrap(() => this.raw.prepare(sql).all(...(params as SQLInputValue[])) as T[]);
  }
  async get<T>(sql: string, params: readonly unknown[] = []): Promise<T | undefined> {
    return this.wrap(() => this.raw.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined);
  }
  async run(sql: string, params: readonly unknown[] = []): Promise<RunResult> {
    return this.wrap(() => ({ changes: Number(this.raw.prepare(sql).run(...(params as SQLInputValue[])).changes) }));
  }
  async migrate() {
    return migrateSqlite(this.raw).applied;
  }
  async housekeeping() {
    try {
      this.raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      this.raw.exec('PRAGMA optimize');
    } catch {
      /* in-memory databases and busy writers: not fatal */
    }
  }
  async ping() {
    this.raw.prepare('SELECT 1').get();
  }
  async close() {
    this.raw.close();
  }
}
