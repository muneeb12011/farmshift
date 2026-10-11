export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/** Append-only. Never edit an applied migration; add a new one. */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init',
    sql: `
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

-- owner_id NULL = built-in demo farm (read-only, visible to everyone)
CREATE TABLE farms (
  id         TEXT PRIMARY KEY,
  owner_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  lat        REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon        REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
  area_ha    REAL NOT NULL CHECK (area_ha > 0),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_farms_owner ON farms(owner_id);

CREATE TABLE farm_profiles (
  farm_id            TEXT PRIMARY KEY REFERENCES farms(id) ON DELETE CASCADE,
  soil_json          TEXT NOT NULL,
  current_crop       TEXT NOT NULL,
  water_availability TEXT NOT NULL,
  irrigation_type    TEXT NOT NULL,
  priorities_json    TEXT NOT NULL,
  updated_at         INTEGER NOT NULL
);

-- user_id NULL = anonymous run, reachable only through its unguessable id
CREATE TABLE scenario_runs (
  id             TEXT PRIMARY KEY,
  user_id        TEXT REFERENCES users(id) ON DELETE CASCADE,
  farm_id        TEXT REFERENCES farms(id) ON DELETE SET NULL,
  engine_version TEXT NOT NULL,
  input_json     TEXT NOT NULL,
  result_json    TEXT NOT NULL,
  created_at     INTEGER NOT NULL
);
CREATE INDEX idx_runs_user ON scenario_runs(user_id, created_at DESC);

CREATE TABLE rotation_plans (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id      TEXT REFERENCES farms(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  crops_json   TEXT NOT NULL,
  notes        TEXT,
  metrics_json TEXT,
  overall      INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_plans_user ON rotation_plans(user_id, updated_at DESC);

CREATE TABLE env_cache (
  key        TEXT PRIMARY KEY,
  prefix     TEXT NOT NULL,
  payload    TEXT NOT NULL,
  source     TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_env_cache_prefix ON env_cache(prefix, fetched_at DESC);
`,
  },
  {
    version: 2,
    name: 'user_token_version',
    // Bumping this invalidates every previously issued JWT for the user (logout-all, password change).
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
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_password_resets_user ON password_resets(user_id, created_at DESC);
`,
  },
];
