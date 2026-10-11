# FarmShift: frontend + backend

```
farmshift/           Next.js frontend (connected to the API)
farmshift-backend/   Fastify API: NASA POWER + MODIS satellite data, FAO-56 agronomy, rotation scenario engine
scripts/             one-command setup and launcher
```

## Run it

Requires **Node 22.13 or newer** (the backend uses Node's built-in SQLite). Check with `node -v`;
install the current LTS from https://nodejs.org if it is older.

```bash
npm run setup     # installs both projects (one time)
npm run init      # generates the local JWT secret and metrics token (one time)
npm run dev       # starts both
```

* Frontend: http://localhost:3000 (start at **Dashboard**, then **Farm Setup** → **Rotation Builder** → **Scenarios**)
* API: http://localhost:4000 · interactive docs: http://localhost:4000/docs

`Ctrl-C` stops both. Ready-made config is already in place (`farmshift/.env.local`, `farmshift-backend/.env`).

## What is real now

| Screen | Data source |
|---|---|
| Dashboard cards and charts | NASA POWER (temperature, rain, soil wetness) and MODIS NDVI for the **selected field's coordinates**; ET from FAO-56 Penman-Monteith |
| Farm Setup | Your soil, crop, water and priorities feed every scenario |
| Rotation Builder | "Generate" calls the engine; the crops you pick set the cycle length and are included in every scenario |
| Scenarios, Comparison, Trade-offs, AI Insights | Computed per field and profile. "Current Plan" in the comparison is the real baseline (continuing your current crop) |

`ENV_PROVIDER=auto` (default) uses live NASA data. If NASA is unreachable the API falls back to cached data, then to a
**labelled synthetic model**; the dashboard and scenarios pages show an amber "modelled demo data, not observations"
banner whenever that happens. Offline? Set `ENV_PROVIDER=synthetic` in `farmshift-backend/.env`.

## What changed in the frontend (nothing else was touched)

| File | Change |
|---|---|
| `src/services/api.ts` | Rewritten: mock data → HTTP client for the backend (same function names, plus scenario-run helpers) |
| `src/hooks/useScenarioRequest.ts` | **New.** Builds the backend request from the selected field and farm-profile store |
| `src/app/dashboard/page.tsx` | Passes the selected field's coordinates; error handling; synthetic-data banner |
| `src/app/scenarios/page.tsx` | Loads scenarios from the backend instead of `mockScenarios`; loading/error states |
| `src/app/rotation-builder/page.tsx` | "Generate" sends your rotation to the backend (behind the existing progress animation); shows errors |
| `src/components/scenarios/ScenarioComparison.tsx` | Takes the real `baseline` as a prop instead of the mock `currentPlanMetrics` |
| `src/types/index.ts` | Adds optional `meta` / `score` fields to `EnvironmentSummary` |
| `src/components/layout/Navbar.tsx` | Adds the account menu (Sign in / My Plans / Sign out) |
| `src/components/layout/AccountMenu.tsx` | **New.** The account menu |
| `src/components/scenarios/SavePlanButton.tsx` | **New.** "Save as a plan" on the Scenarios page |
| `src/app/login/page.tsx`, `src/app/plans/page.tsx` | **New.** Sign in / register, and the saved-plans list |
| `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx` | **New.** Request a reset email; choose a new password from the emailed link |
| `src/store/auth.ts` | **New.** Session state for the UI |
| `.env.local` | **New.** `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` |
| `Dockerfile`, `.dockerignore` | **New.** Production image for the frontend |

Accounts are optional: the whole app works anonymously. Sessions are `HttpOnly` cookies (no credential in `localStorage`), and a stale or revoked session is cleared by the server so it can never break a page. Passwords can be reset by email.
The mock files in `src/data/` are still used for farm/crop pickers (their ids match the backend's seeded demo farms and crop catalog).

## Useful commands

```bash
npm test                 # ~150 backend tests, no network needed (SQLite)
TEST_DATABASE_URL=postgres://... npm test   # the same suite against PostgreSQL (~160 tests)
npm run typecheck        # backend + frontend
npm run smoke:live       # with internet: verifies NASA POWER + MODIS against the real services
npm run set-key -- ANTHROPIC_API_KEY=sk-ant-...   # optional AI explanations (no other keys are needed)
npm run backup           # consistent snapshot of the database
```

## Going to production

See **`docs/DEPLOYMENT.md`**: Docker Compose with automatic HTTPS (Caddy), backups, metrics, which API keys exist, and an
honest list of what the setup does not cover (PostgreSQL option, SMTP for reset emails, backups). Short version: `npm run init:prod -- your.domain.com` then
`docker compose --env-file .env.production up -d --build`. CI (`.github/workflows/ci.yml`) runs typecheck, tests, builds and Docker builds.

## Troubleshooting

* **"Cannot reach the FarmShift API"** in the UI → the backend isn't running; use `npm run dev` from this folder.
* **`node:sqlite` / "Unexpected token" errors** → Node is too old; upgrade to 22.13+.
* **Port 3000 busy** → Next moves to 3001; in development the API accepts any `localhost` port, so it still works.
* **First load of a new location is slow (several seconds)** → it is fetching 5 years from NASA; repeats come from the cache.
* **`next build` fails offline** → the app downloads Google Fonts at build time (this was already the case before).
  `next dev` is unaffected.

See `farmshift-backend/README.md` for the API, methods, limits and deployment (Dockerfile included).
