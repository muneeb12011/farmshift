import type { Env } from '../config/env.js';
import type { CacheRepo } from '../repos/cache.js';
import { AppError } from '../lib/errors.js';
import { round } from '../lib/math.js';
import {
  MS_DAY,
  doyClimatology,
  isoDate,
  parseIsoDate,
  type ClimateBundle,
  type DailyClimate,
} from '../engine/climate.js';
import { fetchNasaPowerDaily } from './nasa-power.js';
import { fetchModisNdvi, type NdviComposite } from './modis-ndvi.js';
import { estimateNdvi } from './ndvi-model.js';
import { generateSyntheticClimate } from './synthetic.js';

export interface Logger {
  info: (obj: object | string, msg?: string) => void;
  warn: (obj: object | string, msg?: string) => void;
}
const noopLog: Logger = { info: () => {}, warn: () => {} };

export interface EnvironmentServiceDeps {
  env: Env;
  cache: CacheRepo;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  log?: Logger;
  /** Base backoff between upstream retries (ms); lowered in tests. */
  retryBaseMs?: number;
  /** Observability hook (cache hits, upstream outcomes, fallbacks). */
  onEvent?: (event: EnvironmentEvent) => void;
}

export type EnvironmentEvent = 'cache_hit' | 'upstream_ok' | 'upstream_fail' | 'fallback_stale' | 'fallback_synthetic';

/** After an upstream failure, skip upstream attempts for this long (light circuit breaker). */
const FAILURE_COOLDOWN_MS = 60_000;

export class EnvironmentService {
  private inflight = new Map<string, Promise<ClimateBundle>>();
  private failedAt = new Map<string, number>();
  private readonly log: Logger;
  private readonly now: () => Date;

  constructor(private deps: EnvironmentServiceDeps) {
    this.log = deps.log ?? noopLog;
    this.now = deps.now ?? (() => new Date());
  }

  /** Climate + vegetation bundle for a point (rounded to 0.1° ≈ native grid), cached and de-duplicated. */
  async getBundle(lat: number, lon: number): Promise<ClimateBundle> {
    const lat1 = round(lat, 1);
    const lon1 = round(lon, 1);
    const mode = this.deps.env.ENV_PROVIDER;
    const prefix = `climate:v1:${mode}:${lat1}:${lon1}`;
    const end = isoDate(this.now().getTime() - MS_DAY); // yesterday (UTC)
    const key = `${prefix}:${end}`;

    const cached = await this.deps.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.deps.onEvent?.('cache_hit');
      return JSON.parse(cached.payload) as ClimateBundle;
    }
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const p = this.build(lat1, lon1, end, key, prefix).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  private async build(lat: number, lon: number, end: string, key: string, prefix: string): Promise<ClimateBundle> {
    const { env } = this.deps;
    const startMs = parseIsoDate(end).getTime() - env.CLIMATE_YEARS * 365.25 * MS_DAY;
    const start = isoDate(startMs);

    if (env.ENV_PROVIDER === 'synthetic') return this.synthetic(lat, lon, start, end, []);

    const cooling = (this.failedAt.get(prefix) ?? 0) + FAILURE_COOLDOWN_MS > Date.now();
    if (!cooling) {
      try {
        const bundle = await this.fromNasa(lat, lon, start, end);
        await this.deps.cache.put({
          key,
          prefix,
          payload: JSON.stringify(bundle),
          source: bundle.provenance.climate.provider,
          ttlMs: env.ENV_CACHE_TTL_HOURS * 3_600_000,
        });
        this.failedAt.delete(prefix);
        this.deps.onEvent?.('upstream_ok');
        return bundle;
      } catch (e) {
        this.failedAt.set(prefix, Date.now());
        this.deps.onEvent?.('upstream_fail');
        this.log.warn({ err: (e as Error).message, lat, lon }, 'NASA POWER fetch failed');
        if (env.ENV_PROVIDER === 'nasa') {
          if (e instanceof AppError) throw e;
          throw AppError.upstream(`Environmental data provider failed: ${(e as Error).message}`);
        }
        return await this.degrade(prefix, lat, lon, start, end, (e as Error).message);
      }
    }
    if (env.ENV_PROVIDER === 'nasa') throw AppError.upstream('Environmental data provider recently failed; retry shortly');
    return await this.degrade(prefix, lat, lon, start, end, 'recent upstream failure (cooling down)');
  }

  /** Stale cache first (real observations, older), synthetic model last. */
  private async degrade(prefix: string, lat: number, lon: number, start: string, end: string, reason: string): Promise<ClimateBundle> {
    const stale = await this.deps.cache.latestByPrefix(prefix);
    if (stale) {
      this.deps.onEvent?.('fallback_stale');
      const b = JSON.parse(stale.payload) as ClimateBundle;
      b.provenance.climate.stale = true;
      b.provenance.warnings.push(
        `NASA POWER is unavailable (${reason}); serving cached observations fetched ${new Date(stale.fetchedAt).toISOString()}.`,
      );
      return b;
    }
    this.deps.onEvent?.('fallback_synthetic');
    return this.synthetic(lat, lon, start, end, [
      `NASA POWER is unavailable (${reason}). Values below come from a synthetic climate model and are NOT observations.`,
    ]);
  }

  private synthetic(lat: number, lon: number, start: string, end: string, warnings: string[]): ClimateBundle {
    const { daily, elevationM } = generateSyntheticClimate({ lat, lon, start, end });
    const w = [...warnings];
    if (this.deps.env.ENV_PROVIDER === 'synthetic') {
      w.push('ENV_PROVIDER=synthetic: values come from a synthetic climate model and are NOT observations.');
    }
    return {
      lat,
      lon,
      elevationM,
      daily,
      ndvi: estimateNdvi(daily),
      provenance: {
        climate: { provider: 'synthetic', stale: false, fetchedAt: this.now().toISOString() },
        vegetation: { provider: 'phenology-model', quality: 'estimated' },
        warnings: w,
      },
    };
  }

  private async fromNasa(lat: number, lon: number, start: string, end: string): Promise<ClimateBundle> {
    const { env } = this.deps;

    // Start MODIS at the same time as NASA POWER: worst-case cold latency is the slower of the two, not the sum.
    // The task never rejects; its outcome is inspected after NASA succeeds.
    const ndviTask = env.NDVI_ENABLED
      ? fetchModisNdvi({
          base: env.MODIS_BASE,
          lat,
          lon,
          start: isoDate(parseIsoDate(end).getTime() - env.NDVI_YEARS * 365.25 * MS_DAY),
          end,
          timeoutMs: Math.min(env.UPSTREAM_TIMEOUT_MS, 15_000),
          deadlineMs: env.UPSTREAM_DEADLINE_MS,
          fetchImpl: this.deps.fetchImpl,
          retryBaseMs: this.deps.retryBaseMs,
        }).then(
          (composites) => ({ composites }) as const,
          (error: unknown) => ({ error }) as const,
        )
      : null;

    const { daily, elevationM } = await fetchNasaPowerDaily({
      base: env.NASA_POWER_BASE,
      lat,
      lon,
      start,
      end,
      timeoutMs: env.UPSTREAM_TIMEOUT_MS,
      deadlineMs: env.UPSTREAM_DEADLINE_MS,
      fetchImpl: this.deps.fetchImpl,
      retryBaseMs: this.deps.retryBaseMs,
    });

    const warnings: string[] = [];
    let ndvi: number[];
    let vegetation: ClimateBundle['provenance']['vegetation'];

    const trimmedEnd = daily[daily.length - 1]!.date;
    if (trimmedEnd < end) {
      warnings.push(`Most recent NASA POWER data available is ${trimmedEnd} (provider publishes with a lag).`);
    }

    const outcome = ndviTask ? await ndviTask : null;
    if (outcome && 'composites' in outcome) {
      const aligned = alignNdvi(daily, outcome.composites);
      ndvi = aligned.values;
      vegetation = { provider: 'modis-mod13q1', quality: aligned.recentCoverage >= 0.9 ? 'observed' : 'partial' };
      if (aligned.firstObservedDate && aligned.firstObservedDate > daily[0]!.date) {
        warnings.push(
          `NDVI before ${aligned.firstObservedDate} is a day-of-year climatology of observed MODIS composites, not a daily observation.`,
        );
      }
    } else if (outcome) {
      this.log.warn({ err: (outcome.error as Error)?.message }, 'MODIS NDVI fetch failed; using phenology model');
      ndvi = estimateNdvi(daily);
      vegetation = { provider: 'phenology-model', quality: 'estimated' };
      warnings.push('Observed MODIS NDVI unavailable; vegetation index is a phenology-model estimate.');
    } else {
      ndvi = estimateNdvi(daily);
      vegetation = { provider: 'phenology-model', quality: 'estimated' };
      warnings.push('NDVI_ENABLED=false: vegetation index is a phenology-model estimate.');
    }

    return {
      lat,
      lon,
      elevationM,
      daily,
      ndvi,
      provenance: {
        climate: { provider: 'nasa-power', stale: false, fetchedAt: this.now().toISOString() },
        vegetation,
        warnings,
      },
    };
  }
}

/**
 * Interpolate 16-day composites (valid at start + 8 days) onto the daily grid. Days outside the observed span are
 * filled with the day-of-year climatology of the observed series; any remaining gap uses the phenology model.
 */
export function alignNdvi(
  daily: readonly DailyClimate[],
  composites: readonly NdviComposite[],
): { values: number[]; recentCoverage: number; firstObservedDate: string | null } {
  const pts = composites.map((c) => ({ t: parseIsoDate(c.date).getTime() + 8 * MS_DAY, v: c.ndvi })).sort((a, b) => a.t - b.t);
  const raw = new Array<number>(daily.length).fill(NaN);
  let j = 0;
  daily.forEach((d, i) => {
    const t = parseIsoDate(d.date).getTime();
    if (t < pts[0]!.t || t > pts[pts.length - 1]!.t) return;
    while (j < pts.length - 2 && pts[j + 1]!.t < t) j++;
    const a = pts[j]!;
    const b = pts[Math.min(j + 1, pts.length - 1)]!;
    // Do not bridge more than ~2 missing composites.
    if (b.t - a.t > 48 * MS_DAY) return;
    raw[i] = b.t === a.t ? a.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
  });

  const clim = doyClimatology(daily, raw);
  const model = estimateNdvi(daily);
  const values = raw.map((v, i) => (Number.isFinite(v) ? v : (Number.isFinite(clim[daily[i]!.doy]!) ? clim[daily[i]!.doy]! : model[i]!)));

  const recent = raw.slice(Math.max(0, raw.length - 365));
  const recentCoverage = recent.length ? recent.filter(Number.isFinite).length / recent.length : 0;
  const firstIdx = raw.findIndex(Number.isFinite);
  return { values, recentCoverage, firstObservedDate: firstIdx >= 0 ? daily[firstIdx]!.date : null };
}
