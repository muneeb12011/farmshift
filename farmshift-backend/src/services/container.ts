import type { Env } from '../config/env.js';
import type { SqlAdapter } from '../db/adapter.js';
import { PgAdapter } from '../db/pg-adapter.js';
import { SqliteAdapter, type Db } from '../db/sqlite-adapter.js';
import { EnvironmentService, type Logger } from '../providers/environment-service.js';
import { Metrics } from '../plugins/metrics.js';
import { CacheRepo } from '../repos/cache.js';
import { FarmsRepo } from '../repos/farms.js';
import { PlansRepo } from '../repos/plans.js';
import { RunsRepo } from '../repos/runs.js';
import { ResetsRepo } from '../repos/resets.js';
import { UsersRepo } from '../repos/users.js';
import { createMailer, type Mailer } from './mailer.js';
import { createNarrator, type Narrator } from './narrator.js';

export interface Services {
  env: Env;
  /** Dialect-neutral SQL access (SQLite or PostgreSQL, chosen by DATABASE_URL). */
  sql: SqlAdapter;
  /** Raw SQLite handle; only present when running on SQLite (backups, SQLite-specific tests). */
  db?: Db;
  users: UsersRepo;
  farms: FarmsRepo;
  runs: RunsRepo;
  plans: PlansRepo;
  resets: ResetsRepo;
  mailer: Mailer;
  cache: CacheRepo;
  environment: EnvironmentService;
  narrator: Narrator;
  metrics: Metrics;
}

export interface ContainerOverrides {
  fetchImpl?: typeof fetch;
  narrator?: Narrator;
  mailer?: Mailer;
  now?: () => Date;
  log?: Logger;
  retryBaseMs?: number;
}

export async function openSql(env: Env): Promise<SqlAdapter> {
  if (env.DATABASE_URL) {
    return PgAdapter.connect({ url: env.DATABASE_URL, max: env.DATABASE_POOL_MAX, ssl: env.DATABASE_SSL, schema: env.DATABASE_SCHEMA });
  }
  return SqliteAdapter.open(env.DATABASE_PATH);
}

export async function createServices(env: Env, overrides: ContainerOverrides = {}): Promise<Services> {
  const sql = await openSql(env);
  await sql.migrate();
  const cache = new CacheRepo(sql);
  const farms = new FarmsRepo(sql);
  await farms.seedDemo();
  const metrics = new Metrics();
  return {
    env,
    sql,
    db: sql instanceof SqliteAdapter ? sql.raw : undefined,
    users: new UsersRepo(sql),
    farms,
    runs: new RunsRepo(sql),
    plans: new PlansRepo(sql),
    resets: new ResetsRepo(sql),
    mailer: overrides.mailer ?? createMailer(env, (overrides.log as never) ?? { warn: console.warn, error: console.error }),
    cache,
    environment: new EnvironmentService({ env, cache, fetchImpl: overrides.fetchImpl, now: overrides.now, log: overrides.log, onEvent: (e) => metrics.event(e), retryBaseMs: overrides.retryBaseMs }),
    narrator: overrides.narrator ?? createNarrator(env, overrides.fetchImpl),
    metrics,
  };
}
