import type { Migration } from './migrations.js';

/**
 * PostgreSQL schema. Mirrors src/db/migrations.ts table-for-table (a test enforces column parity).
 * Differences: BIGINT timestamps (epoch ms), DOUBLE PRECISION coordinates, case-insensitive unique email via lower().
 * Append-only: never edit an applied migration.
 */
export const PG_MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init',
    sql: `
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    BIGINT NOT NULL
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE farms (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon        DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN -180 AND 180),
  area_ha    DOUBLE PRECISION NOT NULL CHECK (area_ha > 0),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX idx_farms_owner ON farms(owner_id);

CREATE TABLE farm_profiles (
  farm_id            TEXT PRIMARY KEY REFERENCES farms(id) ON DELETE CASCADE,
  soil_json          TEXT NOT NULL,
  current_crop       TEXT NOT NULL,
  water_availability TEXT NOT NULL,
  irrigation_type    TEXT NOT NULL,
  priorities_json    TEXT NOT NULL,
  updated_at         BIGINT NOT NULL
);

CREATE TABLE scenario_runs (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id) ON DELETE CASCADE,
  farm_id        TEXT REFERENCES farms(id) ON DELETE SET NULL,
  engine_version TEXT NOT NULL,
  input_json     TEXT NOT NULL,
  result_json    TEXT NOT NULL,
  created_at     BIGINT NOT NULL
);
CREATE INDEX idx_runs_user ON scenario_runs(user_id, created_at DESC);
CREATE INDEX idx_runs_anon_created ON scenario_runs(created_at) WHERE user_id IS NULL;

CREATE TABLE rotation_plans (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id      TEXT REFERENCES farms(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  crops_json   TEXT NOT NULL,
  notes        TEXT,
  metrics_json TEXT,
  overall      INTEGER,
  created_at   BIGINT NOT NULL,
  updated_at   BIGINT NOT NULL
);
CREATE INDEX idx_plans_user ON rotation_plans(user_id, updated_at DESC);

CREATE TABLE env_cache (
  key        TEXT PRIMARY KEY,
  prefix     TEXT NOT NULL,
  payload    TEXT NOT NULL,
  source     TEXT NOT NULL,
  fetched_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX idx_env_cache_prefix ON env_cache(prefix, fetched_at DESC);
`,
  },
  {
    version: 2,
    name: 'user_token_version',
    sql: `ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    version: 3,
    name: 'password_resets',
    sql: `
CREATE TABLE password_resets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used_at    BIGINT,
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_password_resets_user ON password_resets(user_id, created_at DESC);
`,
  },
];
