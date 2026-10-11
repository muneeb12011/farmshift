import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(0).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** SQLite file path (default). Ignored when DATABASE_URL is set. */
  DATABASE_PATH: z.string().default('./data/farmshift.db'),
  /** postgres://user:pass@host:5432/dbname : switches the whole app to PostgreSQL (needed to run more than one instance). */
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must start with postgres:// or postgresql://').optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  /** Use TLS to the database (typical for managed Postgres). */
  DATABASE_SSL: bool.default(false),
  /** PostgreSQL schema to use (created if missing). */
  DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default('public'),

  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(240),

  // --- environmental data providers ---
  // auto: NASA POWER, falling back to stale cache, then synthetic model
  ENV_PROVIDER: z.enum(['auto', 'nasa', 'synthetic']).default('auto'),
  NASA_POWER_BASE: z.string().url().default('https://power.larc.nasa.gov/api/temporal/daily/point'),
  MODIS_BASE: z.string().url().default('https://modis.ornl.gov/rst/api/v1'),
  NDVI_ENABLED: bool.default(true),
  NDVI_YEARS: z.coerce.number().int().min(1).max(5).default(2),
  CLIMATE_YEARS: z.coerce.number().int().min(2).max(10).default(5),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  /** Total time budget for one upstream call including retries. */
  UPSTREAM_DEADLINE_MS: z.coerce.number().int().positive().default(20_000),
  ENV_CACHE_TTL_HOURS: z.coerce.number().positive().default(12),

  // --- operations ---
  /** Prefetch the demo farms' climate at startup so the first dashboard load is instant. */
  WARMUP_DEMO_FARMS: bool.default(true),
  /** Anonymous scenario runs older than this are deleted (runs owned by accounts are kept). */
  RUN_RETENTION_DAYS: z.coerce.number().positive().default(30),
  MAINTENANCE_INTERVAL_HOURS: z.coerce.number().positive().default(6),
  /** Bearer token required for GET /metrics. In production the endpoint is disabled unless this is set. */
  METRICS_TOKEN: z.string().min(16).optional(),

  // --- email (password reset) ---
  /** e.g. smtps://user:pass@smtp.example.com:465 (SendGrid, Mailgun, Postmark, SES, Gmail app password, ...). Unset in development logs the link instead. */
  SMTP_URL: z.string().regex(/^smtps?:\/\//, 'must start with smtp:// or smtps://').optional(),
  MAIL_FROM: z.string().default('FarmShift <no-reply@localhost>'),
  /** Public URL of the web app; used to build the reset link. */
  APP_URL: z.string().url().default('http://localhost:3000'),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),

  // --- optional LLM narration (numbers always come from the engine) ---
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  ANTHROPIC_BASE: z.string().url().default('https://api.anthropic.com'),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // `KEY=` lines (as in .env.example) arrive as empty strings; treat them as unset so defaults apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production');
  }
  return env;
}

export const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789';
