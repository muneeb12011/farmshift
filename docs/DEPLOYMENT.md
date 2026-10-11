# Deploying FarmShift

## 0. Which API keys do you need?

| Key | Needed? | Where to get it | What it enables |
|---|---|---|---|
| **NASA POWER** | **No key** | public API | live temperature, rain, soil wetness |
| **MODIS NDVI (ORNL DAAC)** | **No key** | public API | observed vegetation index |
| `ANTHROPIC_API_KEY` | Optional | https://console.anthropic.com | AI-written scenario explanations (`"narration":"llm"`). Without it the app uses its deterministic explanations. |
| `JWT_SECRET`, `METRICS_TOKEN`, `POSTGRES_PASSWORD` | Generated for you | `npm run init` / `npm run init:prod` | session signing, protected `/metrics`, bundled Postgres |
| `SMTP_URL` | Needed for password reset in production | any SMTP provider (SendGrid, Mailgun, Postmark, Amazon SES, Gmail app password) | emailing the reset link |

Set a key without opening any file (the value is never printed):

```bash
npm run set-key -- ANTHROPIC_API_KEY=sk-ant-...              # local dev
npm run set-key -- --prod ANTHROPIC_API_KEY=sk-ant-...       # production (.env.production)
```

Never commit `.env` or `.env.production` (both are git-ignored in the sub-projects; keep them out of any repo you create at the root).

## 1. Single server with Docker (recommended start)

Needs Docker and a domain whose DNS A-record points at the server (ports 80 and 443 open).

```bash
npm run init:prod -- farmshift.yourdomain.com     # writes .env.production with fresh secrets (chmod 600)
npm run set-key -- --prod SMTP_URL=smtps://user:pass@smtp.provider.com:465   # password-reset email
npm run set-key -- --prod ANTHROPIC_API_KEY=...   # optional
docker compose --env-file .env.production up -d --build
```

Caddy obtains and renews the HTTPS certificate automatically. Routing: `/api/*`, `/docs`, `/health`, `/ready` → API;
everything else → the Next.js app (same origin, so no CORS configuration is needed). `/metrics` is deliberately not routed publicly.

Check it: `https://your.domain/ready` should return `{"status":"ready",...}`; then open the site.

## 2. Operating it

| Task | Command |
|---|---|
| Logs | `docker compose logs -f api` |
| Update | `git pull && docker compose --env-file .env.production up -d --build` (schema migrations run automatically at start) |
| Backup (online, consistent) | `docker compose exec api node dist/cli/backup.js /data/backups 14` |
| Restore | stop `api`, copy a `farmshift-*.db` over `/data/farmshift.db` in the `api_data` volume, start `api` |
| Metrics | `GET /metrics` with `Authorization: Bearer $METRICS_TOKEN` (Prometheus text format), from inside the Docker network |
| Revoke all sessions of a user | the user calls `POST /api/v1/auth/logout-all` (or changes their password) |

Schedule the backup with cron, e.g. daily at 03:00:
`0 3 * * * cd /srv/farmshift && docker compose exec -T api node dist/cli/backup.js /data/backups 14`.
**Copy backups off the server**; a backup on the same disk does not survive disk loss.

Housekeeping is automatic: anonymous scenario runs older than `RUN_RETENTION_DAYS` (default 30) and stale cache rows are
purged every 6 hours; runs owned by accounts are never purged. Demo-farm climate is prefetched at startup.

## 2b. PostgreSQL (more than one API instance, managed backups)

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml --env-file .env.production up -d --build
```
or point `DATABASE_URL` (and `DATABASE_SSL=true`) at a managed database. Tables are created automatically at startup
(concurrent instances are safe: migrations run under a database lock). Back up with `pg_dump "$DATABASE_URL" -Fc -f farmshift.dump`
(`npm run backup` is for SQLite). Moving existing SQLite data to Postgres is not automated; start Postgres deployments fresh
or export/import the few tables you need.

## 2c. Sessions and password reset

* Browsers sign in with an `HttpOnly; SameSite=Lax` cookie (`Secure` in production); no credential is stored in `localStorage`.
  Cookie-authenticated writes also require an allowed `Origin` (`CORS_ORIGINS`), so a malicious site cannot act as your user.
  API clients can still use `Authorization: Bearer <token>` (returned by `/auth/login` unless the `x-auth-mode: cookie` header is sent).
* "Forgot password" emails a single-use link valid for `RESET_TOKEN_TTL_MINUTES` (60). Only a SHA-256 hash of the token is stored,
  the endpoint answers identically for unknown addresses, and a reset signs the user out everywhere.
  In development, with no `SMTP_URL`, the link is printed in the API log.

## 3. Without Docker

```bash
# backend
cd farmshift-backend && npm ci && npm run build
NODE_ENV=production JWT_SECRET=... DATABASE_PATH=/var/lib/farmshift/farmshift.db CORS_ORIGINS=https://your.domain node dist/server.js
# frontend
cd farmshift && NEXT_PUBLIC_API_URL=https://your.domain/api/v1 npm run build && npm start
```
Put any reverse proxy with TLS in front, and set `trustProxy` correctly (the API enables it automatically in production so rate limiting sees the real client IP).

## 4. What this setup does not cover

* **SQLite is single-instance**: run one API container per SQLite file. For several instances use PostgreSQL (section 2b).
* **Email verification at sign-up** is not implemented (password reset is). Anyone can register with any address.
* **SQLite to Postgres data migration** is not automated.
* **Monitoring/alerting** beyond `/metrics`, **log shipping**, and **automated off-site backups** are yours to connect.
* The Docker/Compose files were validated for syntax but **not built in the environment where this was authored** (no Docker available). The Postgres code path, however, was tested against a real PostgreSQL 18 server. Run the first Docker build on your server and read the output.
