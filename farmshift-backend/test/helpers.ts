import { buildApp } from '../src/app.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { generateSyntheticClimate } from '../src/providers/synthetic.js';
import type { ContainerOverrides } from '../src/services/container.js';

/** Set TEST_DATABASE_URL=postgres://... to run the entire suite against PostgreSQL (each app gets its own schema). */
export const PG_URL = process.env.TEST_DATABASE_URL;
export const USING_PG = !!PG_URL;
let schemaSeq = 0;

export function makeEnv(overrides: Record<string, string> = {}): Env {
  const pg: Record<string, string> = PG_URL
    ? { DATABASE_URL: PG_URL, DATABASE_SCHEMA: `t_${process.pid}_${Date.now().toString(36)}_${schemaSeq++}`, DATABASE_POOL_MAX: '3' }
    : {};
  return loadEnv({
    ...pg,
    NODE_ENV: 'test',
    DATABASE_PATH: ':memory:',
    LOG_LEVEL: 'silent',
    ENV_PROVIDER: 'synthetic',
    NDVI_ENABLED: 'false',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    RATE_LIMIT_MAX: '100000',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

const open: Awaited<ReturnType<typeof buildApp>>[] = [];

export async function testApp(envOverrides: Record<string, string> = {}, overrides: ContainerOverrides = {}) {
  const built = await buildApp(makeEnv(envOverrides), overrides);
  await built.app.ready();
  open.push(built);
  return built;
}

/** Close every app created during a test; on PostgreSQL also drops its private schema. */
export async function closeAllApps() {
  while (open.length) {
    const { app, services } = open.pop()!;
    const sql = services.sql as { dropSchema?: () => Promise<void> };
    await sql.dropSchema?.().catch(() => undefined);
    await app.close().catch(() => undefined);
  }
}

const ymd = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;

export interface FakeUpstream {
  fetch: typeof fetch;
  calls: { url: string; kind: 'nasa' | 'modis' | 'other' }[];
  /** Number of leading calls (any kind) to fail with 503 */
  failNext: (n: number) => void;
  failAll: (v: boolean) => void;
}

/** In-process stand-in for NASA POWER and the ORNL MODIS service, derived from the synthetic generator. */
export function fakeUpstream(opts: { missingTail?: number; modis?: boolean } = {}): FakeUpstream {
  const calls: FakeUpstream['calls'] = [];
  let failures = 0;
  let failAll = false;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  const impl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    const u = new URL(url);
    const kind: 'nasa' | 'modis' | 'other' = url.includes('power.larc') ? 'nasa' : url.includes('modis.ornl') ? 'modis' : 'other';
    calls.push({ url, kind });
    if (failAll || failures > 0) {
      failures = Math.max(0, failures - 1);
      return json({ error: 'unavailable' }, 503);
    }

    if (kind === 'nasa') {
      const lat = Number(u.searchParams.get('latitude'));
      const lon = Number(u.searchParams.get('longitude'));
      const start = ymd(u.searchParams.get('start')!);
      const end = ymd(u.searchParams.get('end')!);
      const { daily, elevationM } = generateSyntheticClimate({ lat, lon, start, end });
      const param: Record<string, Record<string, number>> = { T2M: {}, T2M_MAX: {}, T2M_MIN: {}, PRECTOTCORR: {}, RH2M: {}, WS2M: {}, ALLSKY_SFC_SW_DWN: {}, GWETROOT: {} };
      const tail = opts.missingTail ?? 0;
      daily.forEach((d, i) => {
        const k = d.date.replaceAll('-', '');
        const missing = i >= daily.length - tail;
        const v = (x: number) => (missing ? -999 : x);
        param.T2M![k] = v(d.tMean);
        param.T2M_MAX![k] = v(d.tMax);
        param.T2M_MIN![k] = v(d.tMin);
        param.PRECTOTCORR![k] = v(d.precip);
        param.RH2M![k] = v(d.rh);
        param.WS2M![k] = v(d.wind);
        param.ALLSKY_SFC_SW_DWN![k] = v(d.solar);
        param.GWETROOT![k] = v(d.soilWetness);
      });
      return json({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat, elevationM] }, properties: { parameter: param }, header: { fill_value: -999 } });
    }

    if (kind === 'modis') {
      if (opts.modis === false) return json({ error: 'nope' }, 500);
      const sd = u.searchParams.get('startDate')!;
      const ed = u.searchParams.get('endDate')!;
      const toMs = (a: string) => Date.UTC(Number(a.slice(1, 5)), 0, 1) + (Number(a.slice(5)) - 1) * 86_400_000;
      const rows: unknown[] = [];
      for (let t = toMs(sd); t <= toMs(ed); t += 16 * 86_400_000) {
        const date = new Date(t);
        const doy = Math.floor((t - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000);
        const ndvi = 0.5 + 0.25 * Math.sin((2 * Math.PI * (doy - 80)) / 365);
        const iso = date.toISOString().slice(0, 10);
        rows.push({ band: '250m_16_days_NDVI', calendar_date: iso, modis_date: `A${date.getUTCFullYear()}${String(doy).padStart(3, '0')}`, data: [Math.round(ndvi * 10_000)] });
        rows.push({ band: '250m_16_days_EVI', calendar_date: iso, data: [3000] });
      }
      return json({ scale: '0.0001', subset: rows });
    }
    return json({ error: 'unexpected host' }, 500);
  };

  return {
    fetch: impl as typeof fetch,
    calls,
    failNext: (n) => (failures = n),
    failAll: (v) => (failAll = v),
  };
}

export async function registerUser(app: Awaited<ReturnType<typeof testApp>>['app'], email: string, name = 'Test User') {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email, password: 'correct horse battery', name } });
  const body = res.json() as { token: string; user: { id: string } };
  return { token: body.token, id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}
