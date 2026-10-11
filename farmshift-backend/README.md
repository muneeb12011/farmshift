# FarmShift Backend

API for FarmShift: **satellite-derived field conditions** and an **agronomic crop-rotation scenario engine**.
Built to match the FarmShift frontend's types so it can replace the mock data layer.

* Node 22 · TypeScript · Fastify 5 · Zod 4 · SQLite (`node:sqlite`, default) **or PostgreSQL** (`DATABASE_URL`)
* Real data: **NASA POWER** (temperature, rain, humidity, wind, radiation, root-zone wetness) and
  **MODIS MOD13Q1 NDVI** (ORNL DAAC)
* Real science: **FAO-56 Penman-Monteith ET0** (verified against FAO's worked example), USDA-SCS effective rainfall,
  FAO-33 yield response to water deficit
* OpenAPI docs at `/docs`, JSON spec at `/openapi.json`

## Quick start

```bash
npm install
cp .env.example .env          # ENV_PROVIDER=synthetic works offline; auto uses NASA POWER
npm run dev                   # http://localhost:4000/docs  (or run both apps from the repo root: npm run dev)
npm test                      # 100+ tests, no network needed
npm run smoke:live            # on a machine with internet: checks NASA POWER + MODIS against the real services
```

Docker: `docker build -t farmshift-api . && docker run -p 4000:4000 -e JWT_SECRET=$(openssl rand -base64 48) -v fsdata:/data farmshift-api`

## What it does

```
          ┌────────────── providers ──────────────┐
 client → │ NASA POWER ─┐                          │
          │ MODIS NDVI ─┼→ cache (SQLite, 12 h) ───┼→ ClimateBundle ─┬→ summarise() → dashboard
          │ (fallbacks: stale cache → synthetic)   │                 └→ scenario engine
          └────────────────────────────────────────┘                        │
 farm profile (soil, crop, water, priorities) ──────────────────────────────┘
                                                                  generate → score → select → narrate
```

**Scenario engine** (`src/engine`): for a field, it computes each crop's growing window from latitude and
climate, runs a water balance (ETc = ET0 × Kc, effective rain, stored soil water, irrigation cap from your
water availability), scores temperature/heat/pH/drainage fit, then evaluates every admissible rotation
(no identical neighbours, repeat caps, cyclic nitrogen credits, pest/disease family breaks). It returns
distinct archetypes (A Balanced, B Water Resilient, C Soil Regenerative, D Diversified, E Low-Input) ranked
by your weighted priorities, with metrics, computed trade-offs, a grounded explanation, and per-crop detail.
`GET /api/v1/meta/engine` documents every metric.

### Endpoints (all under `/api/v1`)

| Area | Endpoints |
|---|---|
| Environment | `GET /environment/summary?lat&lon` · `GET /environment/timeseries?lat&lon&range=30d\|6m\|1y\|5y&resolution&envelope` · same under `/farms/:id/environment/*` |
| Scenarios | `POST /scenarios/generate` · `POST /scenarios/evaluate` · `GET /runs[/:id]` · `GET /runs/:id/scenarios/:sid` · `POST /runs/:id/compare` · `DELETE /runs/:id` |
| Farms | `GET/POST /farms` · `GET/PATCH/DELETE /farms/:id` · `GET/PUT /farms/:id/profile` (4 read-only demo farms are seeded) |
| Crops | `GET /crops[?detail=full]` · `GET /crops/:idOrName` |
| Plans | `POST/GET /plans` · `GET/PATCH/DELETE /plans/:id` (scored by the engine on save) |
| Auth | `POST /auth/register` · `/auth/login` · `GET /auth/me` · `POST /auth/logout-all` · `POST /auth/change-password` (JWT, scrypt) |
| Meta | `GET /meta/sources` · `GET /meta/engine` · `GET /health` · `GET /ready` |

Reads and scenario generation work **without an account**; accounts add private farms, saved plans and run history.

## Design decisions worth knowing

* **Never fabricates quietly.** `ENV_PROVIDER=auto` degrades NASA → stale cache (flagged `stale`) → synthetic
  model, and every degraded response carries a warning and an `x-data-provider` header. `ENV_PROVIDER=nasa`
  returns 502 instead of falling back. NDVI that is not observed is labelled `estimated`.
* **Honest sources.** Root-zone wetness is NASA POWER's MERRA-2 model product (GWETROOT), not SMAP, and is labelled so.
* **Optional LLM narration** (`"narration":"llm"` + `ANTHROPIC_API_KEY`): the model may only rephrase; output is
  discarded unless every number it mentions is derivable from the engine's facts.
* **Tenant isolation**: other users' farms/plans/runs return 404 (not 403) so their existence does not leak.
  Anonymous runs are reachable only via their 128-bit id.
* **Security basics**: scrypt password hashing (N=2^15), constant-work login, rate limits (stricter on auth and
  generation), Helmet, CORS allow-list, JWT secret required in production, request ids, redacted auth logs.
* **Operations**: `GET /metrics` (Prometheus, token-protected, off in production unless `METRICS_TOKEN` is set), automatic
  retention of anonymous runs and cache (`RUN_RETENTION_DAYS`), demo-farm cache warm-up at startup, per-call upstream
  deadlines, online backups (`npm run backup`), `POST /auth/logout-all` and `/auth/change-password` revoke sessions.
* **Storage**: one set of repositories over a small async SQL adapter, so the same code and the same test-suite run on SQLite (default, single instance) and PostgreSQL (`DATABASE_URL`, several instances, migrations under an advisory lock). Versioned, append-only migrations for each dialect (`src/db/migrations.ts`, `src/db/pg-migrations.ts`; a test enforces schema parity).
* **Sessions**: browsers use an `HttpOnly; SameSite=Lax` cookie with an Origin check on writes (CSRF); API clients use bearer tokens. **Password reset**: single-use, hashed, expiring links by email (`SMTP_URL`), identical answers for unknown addresses, a reset ends all sessions.

## Limitations (read before trusting numbers)

* Scores **rank rotations**; they are not yield or profit forecasts. The agronomy knowledge base
  (`src/domain/crops.ts`) uses first-order, region-agnostic parameters for 9 crops; calibrate it with an agronomist
  before giving farmers advice.
* NASA POWER is ~0.5° gridded reanalysis, MODIS is 250 m but a single pixel; neither replaces field sensors.
* SQLite is single-instance; use PostgreSQL for more than one API instance. Existing SQLite data is not auto-migrated to Postgres.
* No email verification at sign-up.
* The synthetic climate exists for offline development and as a flagged last resort, not for decisions.

## Layout

```
src/engine      et0, climate stats, season windows, crop evaluation, rotation scoring, generator, narrative
src/providers   nasa-power, modis-ndvi, ndvi-model, synthetic, environment-service (cache/fallback/single-flight)
src/routes      HTTP modules      src/plugins  auth + error envelope
src/repos       SQLite repositories   src/db  client + migrations   src/services  DI container, LLM narrator
test            unit, provider (fake NASA/MODIS upstream), engine invariants, full HTTP integration
```
