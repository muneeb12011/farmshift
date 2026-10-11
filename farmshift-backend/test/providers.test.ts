import { describe, expect, it } from 'vitest';
import { fetchJson } from '../src/lib/http.js';
import { parsePowerResponse, fetchNasaPowerDaily } from '../src/providers/nasa-power.js';
import { compositeDates, fetchModisNdvi, parseSubset } from '../src/providers/modis-ndvi.js';
import { EnvironmentService, alignNdvi } from '../src/providers/environment-service.js';
import { SqliteAdapter } from '../src/db/sqlite-adapter.js';
import { CacheRepo } from '../src/repos/cache.js';
import { generateSyntheticClimate } from '../src/providers/synthetic.js';
import { fakeUpstream, makeEnv } from './helpers.js';

const resp = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('fetchJson', () => {
  it('retries retryable statuses then succeeds', async () => {
    let n = 0;
    const f = (async () => (++n < 3 ? resp({}, 503) : resp({ ok: true }))) as typeof fetch;
    await expect(fetchJson('http://x', { timeoutMs: 1000, label: 't', fetchImpl: f, retries: 3, retryBaseMs: 1 })).resolves.toEqual({ ok: true });
    expect(n).toBe(3);
  });
  it('does not retry a 404', async () => {
    let n = 0;
    const f = (async () => (++n, resp({}, 404))) as typeof fetch;
    await expect(fetchJson('http://x', { timeoutMs: 1000, label: 't', fetchImpl: f, retries: 3, retryBaseMs: 1 })).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(n).toBe(1);
  });
  it('gives up after exhausting retries and on network errors', async () => {
    const f = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;
    await expect(fetchJson('http://x', { timeoutMs: 1000, label: 'svc', fetchImpl: f, retries: 1, retryBaseMs: 1 })).rejects.toThrow(/svc unreachable/);
  });
  it('times out a hung request', async () => {
    const f = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch;
    await expect(fetchJson('http://x', { timeoutMs: 20, label: 'slow', fetchImpl: f, retries: 0 })).rejects.toThrow(/unreachable/);
  });
});

describe('NASA POWER client', () => {
  const dates = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10).replaceAll('-', ''));
  const build = (n: number, mutate?: (p: Record<string, Record<string, number>>, d: string[]) => void) => {
    const d = dates(n);
    const p: Record<string, Record<string, number>> = { T2M: {}, T2M_MAX: {}, T2M_MIN: {}, PRECTOTCORR: {}, RH2M: {}, WS2M: {}, ALLSKY_SFC_SW_DWN: {}, GWETROOT: {} };
    d.forEach((k, i) => {
      p.T2M![k] = 15 + Math.sin(i / 20) * 5;
      p.T2M_MAX![k] = 22 + Math.sin(i / 20) * 5;
      p.T2M_MIN![k] = 8 + Math.sin(i / 20) * 5;
      p.PRECTOTCORR![k] = i % 5 === 0 ? 4 : 0;
      p.RH2M![k] = 60;
      p.WS2M![k] = 2.5;
      p.ALLSKY_SFC_SW_DWN![k] = 15;
      p.GWETROOT![k] = 0.5;
    });
    mutate?.(p, d);
    return { geometry: { coordinates: [71.5, 34, 420] as [number, number, number] }, properties: { parameter: p }, header: { fill_value: -999 } };
  };

  it('parses daily data, elevation and computes ET0', () => {
    const { daily, elevationM } = parsePowerResponse(build(120), 34);
    expect(daily).toHaveLength(120);
    expect(elevationM).toBe(420);
    expect(daily[0]!.date).toBe('2025-01-01');
    expect(daily.every((d) => d.et0 > 0 && d.et0 < 15)).toBe(true);
  });
  it('trims unpublished trailing days instead of inventing them', () => {
    const { daily } = parsePowerResponse(
      build(120, (p, d) => {
        for (const k of d.slice(-4)) for (const name of Object.keys(p)) p[name]![k] = -999;
      }),
      34,
    );
    expect(daily).toHaveLength(116);
    expect(daily.at(-1)!.date).toBe('2025-04-26');
  });
  it('bridges a short interior gap in a non-critical variable and falls back to Hargreaves radiation', () => {
    const { daily } = parsePowerResponse(
      build(120, (p, d) => {
        p.WS2M![d[50]!] = -999;
        for (let i = 60; i < 66; i++) p.ALLSKY_SFC_SW_DWN![d[i]!] = -999; // 6-day radiation outage
      }),
      34,
    );
    expect(daily[50]!.wind).toBe(2.5); // 1-day gap bridged with the previous value
    expect(daily[61]!.solar).toBe(15); // still within the 3-day bridge
    expect(daily[64]!.solar).not.toBe(15); // beyond the bridge: Hargreaves estimate
    expect(daily[64]!.solar).toBeGreaterThan(5);
    expect(daily[64]!.solar).toBeLessThan(35);
  });
  it('rejects malformed and near-empty payloads', () => {
    expect(() => parsePowerResponse({ properties: {} } as never, 0)).toThrow(/unexpected payload/);
    expect(() => parsePowerResponse(build(10), 0)).toThrow(/too little usable data/);
  });
  it('sends the documented query (AG community, 8 parameters, compact dates)', async () => {
    const up = fakeUpstream();
    await fetchNasaPowerDaily({ base: 'https://power.larc.nasa.gov/api/temporal/daily/point', lat: 30.2, lon: 71.47, start: '2025-01-01', end: '2025-06-30', timeoutMs: 5000, fetchImpl: up.fetch });
    const u = new URL(up.calls[0]!.url);
    expect(u.searchParams.get('community')).toBe('AG');
    expect(u.searchParams.get('start')).toBe('20250101');
    expect(u.searchParams.get('end')).toBe('20250630');
    expect(u.searchParams.get('format')).toBe('JSON');
    expect(u.searchParams.get('parameters')!.split(',')).toEqual(expect.arrayContaining(['T2M', 'PRECTOTCORR', 'GWETROOT', 'WS2M', 'ALLSKY_SFC_SW_DWN', 'RH2M']));
  });
});

describe('MODIS NDVI client', () => {
  it('generates MOD13Q1 composite dates (23 per year, DOY 1,17,…,353)', () => {
    const d = compositeDates('2024-01-01', '2024-12-31');
    expect(d[0]).toEqual({ modis: 'A2024001', iso: '2024-01-01' });
    expect(d[1]!.modis).toBe('A2024017');
    expect(d.at(-1)!.modis).toBe('A2024353');
    expect(d.filter((x) => x.modis.startsWith('A2024'))).toHaveLength(23);
  });
  it('parseSubset keeps only valid NDVI rows and applies the scale factor', () => {
    const rows = parseSubset({
      scale: '0.0001',
      subset: [
        { band: '250m_16_days_NDVI', calendar_date: '2024-01-01', data: [6500] },
        { band: '250m_16_days_NDVI', calendar_date: '2024-01-17', data: [-3000] }, // fill value
        { band: '250m_16_days_EVI', calendar_date: '2024-01-01', data: [4000] }, // other band
      ],
    });
    expect(rows).toEqual([{ date: '2024-01-01', ndvi: 0.65 }]);
    expect(() => parseSubset({} as never)).toThrow(/unexpected payload/);
  });
  it('requests ≤10 composites per call and merges results', async () => {
    const up = fakeUpstream();
    const out = await fetchModisNdvi({ base: 'https://modis.ornl.gov/rst/api/v1', lat: 30, lon: 71, start: '2024-01-01', end: '2025-12-31', timeoutMs: 5000, fetchImpl: up.fetch });
    expect(out.length).toBeGreaterThan(40);
    expect(up.calls.length).toBe(Math.ceil(compositeDates('2024-01-01', '2025-12-31').length / 10));
    expect(out.every((o, i, a) => i === 0 || a[i - 1]!.date <= o.date)).toBe(true);
  });
  it('alignNdvi interpolates, fills older days with climatology and reports coverage', () => {
    const { daily } = generateSyntheticClimate({ lat: 30, lon: 71, start: '2022-01-01', end: '2025-12-31' });
    const comps = compositeDates('2024-06-01', '2025-12-31').map((c) => ({ date: c.iso, ndvi: 0.4 + 0.2 * Math.sin(Number(c.iso.slice(5, 7)) / 2) }));
    const a = alignNdvi(daily, comps);
    expect(a.values).toHaveLength(daily.length);
    expect(a.values.every(Number.isFinite)).toBe(true);
    expect(a.firstObservedDate! > '2024-05-01').toBe(true);
    expect(a.recentCoverage).toBeGreaterThan(0.5);
    expect(a.recentCoverage).toBeLessThan(1);
  });
});

describe('EnvironmentService orchestration', () => {
  const setup = async (envOverrides: Record<string, string> = {}, upOpts: Parameters<typeof fakeUpstream>[0] = {}, now?: () => Date) => {
    const sql = SqliteAdapter.open(':memory:');
    await sql.migrate();
    const cache = new CacheRepo(sql);
    const up = fakeUpstream(upOpts);
    const svc = new EnvironmentService({ env: makeEnv({ ENV_PROVIDER: 'auto', CLIMATE_YEARS: '2', ...envOverrides }), cache, fetchImpl: up.fetch, now, retryBaseMs: 1 });
    return { svc, up, cache };
  };

  it('fetches NASA + MODIS, labels provenance as observed, and caches', async () => {
    const { svc, up } = await setup({ NDVI_ENABLED: 'true', NDVI_YEARS: '1' });
    const b = await svc.getBundle(30.2, 71.47);
    expect(b.provenance.climate.provider).toBe('nasa-power');
    expect(b.provenance.vegetation.provider).toBe('modis-mod13q1');
    expect(b.provenance.vegetation.quality).toBe('observed');
    expect(b.ndvi).toHaveLength(b.daily.length);
    expect(b.daily.length).toBeGreaterThan(700);
    const nasaCalls = up.calls.filter((c) => c.kind === 'nasa').length;
    expect(nasaCalls).toBe(1);
    await svc.getBundle(30.2, 71.47);
    expect(up.calls.filter((c) => c.kind === 'nasa').length).toBe(1); // served from cache
  });

  it('shares coordinates within the 0.1° grid cell (cache hit) but not across cells', async () => {
    const { svc, up } = await setup();
    await svc.getBundle(30.21, 71.46);
    await svc.getBundle(30.24, 71.51);
    expect(up.calls.filter((c) => c.kind === 'nasa')).toHaveLength(1);
    await svc.getBundle(31.5, 71.5);
    expect(up.calls.filter((c) => c.kind === 'nasa')).toHaveLength(2);
  });

  it('de-duplicates concurrent requests for the same cell (single flight)', async () => {
    const { svc, up } = await setup();
    await Promise.all([svc.getBundle(10, 20), svc.getBundle(10, 20), svc.getBundle(10, 20)]);
    expect(up.calls.filter((c) => c.kind === 'nasa')).toHaveLength(1);
  });

  it('reports the provider lag when trailing days are unpublished', async () => {
    const { svc } = await setup({}, { missingTail: 3 });
    const b = await svc.getBundle(30, 70);
    expect(b.provenance.warnings.some((w) => /lag/.test(w))).toBe(true);
  });

  it('degrades NDVI to the phenology model (labelled estimated) when MODIS fails', async () => {
    const { svc } = await setup({ NDVI_ENABLED: 'true' }, { modis: false });
    const b = await svc.getBundle(30, 70);
    expect(b.provenance.climate.provider).toBe('nasa-power');
    expect(b.provenance.vegetation).toEqual({ provider: 'phenology-model', quality: 'estimated' });
    expect(b.provenance.warnings.join(' ')).toMatch(/MODIS NDVI unavailable/);
  });

  it('falls back to the synthetic model with an explicit warning when NASA is down and nothing is cached', async () => {
    const { svc, up } = await setup();
    up.failAll(true);
    const b = await svc.getBundle(30, 70);
    expect(b.provenance.climate.provider).toBe('synthetic');
    expect(b.provenance.warnings.join(' ')).toMatch(/NOT observations/);
  });

  it('serves STALE cached observations (flagged) when NASA fails after the cache expired', async () => {
    let clock = new Date('2026-10-06T10:00:00Z');
    const { svc, up } = await setup({ ENV_CACHE_TTL_HOURS: '0.0000001' }, {}, () => clock);
    const first = await svc.getBundle(30, 70);
    expect(first.provenance.climate.stale).toBe(false);
    await new Promise((r) => setTimeout(r, 10)); // let the tiny TTL lapse
    up.failAll(true);
    const second = await svc.getBundle(30, 70);
    expect(second.provenance.climate.provider).toBe('nasa-power');
    expect(second.provenance.climate.stale).toBe(true);
    expect(second.provenance.warnings.join(' ')).toMatch(/serving cached observations/);
    clock = new Date(clock.getTime() + 1);
  });

  it("ENV_PROVIDER=nasa never fabricates data: upstream failure surfaces as 502", async () => {
    const { svc, up } = await setup({ ENV_PROVIDER: 'nasa' });
    up.failAll(true);
    await expect(svc.getBundle(30, 70)).rejects.toMatchObject({ statusCode: 502, code: 'UPSTREAM_UNAVAILABLE' });
  });

  it('after a failure it cools down instead of hammering the upstream', async () => {
    const { svc, up } = await setup();
    up.failAll(true);
    await svc.getBundle(30, 70);
    const callsAfterFirst = up.calls.length;
    await svc.getBundle(30, 70);
    expect(up.calls.length).toBe(callsAfterFirst);
  }, 30_000);
});
