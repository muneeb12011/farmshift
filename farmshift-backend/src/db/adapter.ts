/**
 * Minimal async SQL surface shared by SQLite and PostgreSQL. All repositories are written against this,
 * using `?` placeholders (translated to $1..$n for PostgreSQL), so both databases run identical repository code.
 */
export interface RunResult {
  /** Rows affected by INSERT/UPDATE/DELETE. */
  changes: number;
}

export interface SqlAdapter {
  readonly dialect: 'sqlite' | 'postgres';
  all<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T | undefined>;
  run(sql: string, params?: readonly unknown[]): Promise<RunResult>;
  /** Apply pending schema migrations for this dialect (safe to call concurrently from several instances). */
  migrate(): Promise<string[]>;
  /** Dialect-specific housekeeping (WAL checkpoint / planner stats for SQLite, ANALYZE for PostgreSQL). */
  housekeeping(): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

/** Thrown by adapters when an INSERT/UPDATE violates a UNIQUE constraint. */
export class UniqueViolation extends Error {
  constructor(message = 'unique constraint violated') {
    super(message);
    this.name = 'UniqueViolation';
  }
}
