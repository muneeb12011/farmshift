import { mean, round, slope, sum } from '../lib/math.js';

/** One day of (observed or modelled) climate at a point. Units are SI/agronomic. */
export interface DailyClimate {
  date: string; // YYYY-MM-DD (UTC)
  doy: number;
  tMean: number; // °C
  tMax: number;
  tMin: number;
  precip: number; // mm
  rh: number; // %
  wind: number; // m/s at 2 m
  solar: number; // MJ m-2 day-1
  soilWetness: number; // 0..1 root-zone wetness
  et0: number; // mm/day (FAO-56 PM)
}

export type ClimateProvider = 'nasa-power' | 'synthetic';
export type VegetationProvider = 'modis-mod13q1' | 'phenology-model';
export type VegetationQuality = 'observed' | 'partial' | 'estimated';

export interface ClimateBundle {
  lat: number;
  lon: number;
  elevationM: number;
  daily: DailyClimate[]; // ascending, contiguous days
  ndvi: number[]; // aligned 1:1 with `daily`
  provenance: {
    climate: { provider: ClimateProvider; stale: boolean; fetchedAt: string };
    vegetation: { provider: VegetationProvider; quality: VegetationQuality };
    warnings: string[];
  };
}

export const MS_DAY = 86_400_000;

export const isoDate = (t: number | Date) => new Date(t).toISOString().slice(0, 10);

export function dayOfYear(d: Date): number {
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / MS_DAY);
}

export function parseIsoDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

/** Tail window helper: the last `n` days of a series (or fewer). */
export const tail = <T>(xs: readonly T[], n: number): T[] => xs.slice(Math.max(0, xs.length - n));

// ---------------------------------------------------------------------------------------------
// Climatology over multi-year windows
// ---------------------------------------------------------------------------------------------

export interface WindowStats {
  tMean: number;
  /** Fraction of days with tMax above `heatThresholdC` (when provided). */
  heatFraction: number;
  precip: number; // mean total across years, mm
  precipCv: number; // interannual coefficient of variation (0 when <2 years)
  et0: number; // mean total across years, mm
  soilWetness: number;
  years: number;
}

/**
 * Statistics for a calendar window `[startDoy, startDoy + days)` aggregated across all years present.
 * Windows may wrap year boundaries (e.g. Nov→Mar). Years with <85% coverage are ignored.
 */
export function windowStats(
  daily: readonly DailyClimate[],
  startDoy: number,
  days: number,
  heatThresholdC?: number,
): WindowStats | null {
  if (daily.length === 0) return null;
  const index = new Map<string, DailyClimate>();
  for (const d of daily) index.set(d.date, d);
  const firstYear = parseIsoDate(daily[0]!.date).getUTCFullYear();
  const lastYear = parseIsoDate(daily[daily.length - 1]!.date).getUTCFullYear();

  const perYear: { t: number; heat: number; p: number; et0: number; w: number }[] = [];
  for (let y = firstYear - 1; y <= lastYear; y++) {
    const start = Date.UTC(y, 0, 1) + (startDoy - 1) * MS_DAY;
    const rows: DailyClimate[] = [];
    for (let k = 0; k < days; k++) {
      const row = index.get(isoDate(start + k * MS_DAY));
      if (row) rows.push(row);
    }
    if (rows.length < days * 0.85) continue;
    const heatDays = heatThresholdC === undefined ? 0 : rows.filter((r) => r.tMax > heatThresholdC).length;
    perYear.push({
      t: mean(rows.map((r) => r.tMean)),
      heat: heatDays / rows.length,
      // Scale partial coverage to the full window length so totals are comparable.
      p: sum(rows.map((r) => r.precip)) * (days / rows.length),
      et0: sum(rows.map((r) => r.et0)) * (days / rows.length),
      w: mean(rows.map((r) => r.soilWetness)),
    });
  }
  if (perYear.length === 0) return null;
  const ps = perYear.map((r) => r.p);
  const pm = mean(ps);
  const sd = perYear.length > 1 ? Math.sqrt(mean(ps.map((p) => (p - pm) ** 2))) : 0;
  return {
    tMean: mean(perYear.map((r) => r.t)),
    heatFraction: mean(perYear.map((r) => r.heat)),
    precip: pm,
    precipCv: pm > 1 ? sd / pm : 0,
    et0: mean(perYear.map((r) => r.et0)),
    soilWetness: mean(perYear.map((r) => r.w)),
    years: perYear.length,
  };
}

export interface MonthlyClimatology {
  tMean: number[]; // 12
  precip: number[]; // mm / month (mean)
  et0: number[]; // mm / month (mean)
}

export function monthlyClimatology(daily: readonly DailyClimate[]): MonthlyClimatology {
  const t: number[][] = Array.from({ length: 12 }, () => []);
  const pByYm = new Map<string, number>();
  const eByYm = new Map<string, number>();
  const countByYm = new Map<string, number>();
  for (const d of daily) {
    const m = Number(d.date.slice(5, 7)) - 1;
    t[m]!.push(d.tMean);
    const ym = d.date.slice(0, 7);
    pByYm.set(ym, (pByYm.get(ym) ?? 0) + d.precip);
    eByYm.set(ym, (eByYm.get(ym) ?? 0) + d.et0);
    countByYm.set(ym, (countByYm.get(ym) ?? 0) + 1);
  }
  const pM: number[][] = Array.from({ length: 12 }, () => []);
  const eM: number[][] = Array.from({ length: 12 }, () => []);
  for (const [ym, cnt] of countByYm) {
    const m = Number(ym.slice(5, 7)) - 1;
    const dim = new Date(Date.UTC(Number(ym.slice(0, 4)), m + 1, 0)).getUTCDate();
    if (cnt < dim * 0.85) continue; // skip partial months
    pM[m]!.push(pByYm.get(ym)! * (dim / cnt));
    eM[m]!.push(eByYm.get(ym)! * (dim / cnt));
  }
  const avg = (xs: number[]) => (xs.length ? mean(xs) : 0);
  return { tMean: t.map(avg), precip: pM.map(avg), et0: eM.map(avg) };
}

/** Mean value by day-of-year (1..366) smoothed with a ±7-day circular window. */
export function doyClimatology(daily: readonly DailyClimate[], values: readonly number[]): number[] {
  const sums = new Array<number>(367).fill(0);
  const counts = new Array<number>(367).fill(0);
  daily.forEach((d, i) => {
    const v = values[i]!;
    if (!Number.isFinite(v)) return; // gaps (NaN) are skipped, not averaged in
    sums[d.doy] = sums[d.doy]! + v;
    counts[d.doy] = counts[d.doy]! + 1;
  });
  const raw = sums.map((s, i) => (counts[i]! > 0 ? s / counts[i]! : NaN));
  const out = new Array<number>(367).fill(NaN);
  for (let d = 1; d <= 366; d++) {
    const vals: number[] = [];
    for (let k = -7; k <= 7; k++) {
      let dd = d + k;
      if (dd < 1) dd += 365;
      if (dd > 366) dd -= 366;
      const v = raw[dd];
      if (v !== undefined && !Number.isNaN(v)) vals.push(v);
    }
    out[d] = vals.length ? mean(vals) : NaN;
  }
  return out;
}

/** Anomaly series relative to day-of-year climatology of the same series. */
export function anomalies(daily: readonly DailyClimate[], values: readonly number[]): number[] {
  const clim = doyClimatology(daily, values);
  return values.map((v, i) => v - (clim[daily[i]!.doy] ?? v));
}

/**
 * Trend of the last `n` days of an anomaly series, as change per 30 days; classified with a threshold.
 * Using anomalies (not raw values) stops the seasonal cycle reading as a "trend".
 */
export function anomalyTrend(anoms: readonly number[], n: number, thresholdPer30d: number): 'increasing' | 'decreasing' | 'stable' {
  const tailVals = tail(anoms, n);
  const per30 = slope(tailVals) * 30;
  if (per30 > thresholdPer30d) return 'increasing';
  if (per30 < -thresholdPer30d) return 'decreasing';
  return 'stable';
}

// ---------------------------------------------------------------------------------------------
// Resampling for the time-series endpoint
// ---------------------------------------------------------------------------------------------

export interface SeriesPoint {
  date: string;
  temperatureC: number;
  precipitationMm: number;
  soilMoisturePercent: number;
  ndvi: number;
  evapotranspirationMm: number;
}

export function toSeriesPoints(b: ClimateBundle): SeriesPoint[] {
  return b.daily.map((d, i) => ({
    date: d.date,
    temperatureC: round(d.tMean, 1),
    precipitationMm: round(d.precip, 1),
    soilMoisturePercent: round(d.soilWetness * 100, 1),
    ndvi: round(b.ndvi[i]!, 2),
    evapotranspirationMm: round(d.et0, 1),
  }));
}

export type Resolution = 'daily' | 'weekly' | 'monthly';

/** Aggregate points: temperature/moisture/NDVI averaged; precipitation and ET summed per bucket day-rate. */
export function resample(points: readonly SeriesPoint[], resolution: Resolution): SeriesPoint[] {
  if (resolution === 'daily') return [...points];
  const buckets = new Map<string, SeriesPoint[]>();
  for (const p of points) {
    const key =
      resolution === 'monthly'
        ? p.date.slice(0, 7)
        : isoDate(Math.floor(parseIsoDate(p.date).getTime() / (7 * MS_DAY)) * 7 * MS_DAY);
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }
  return [...buckets.values()].map((rows) => ({
    date: rows[0]!.date,
    temperatureC: round(mean(rows.map((r) => r.temperatureC)), 1),
    // Keep the unit "mm/day" so charts stay comparable across resolutions.
    precipitationMm: round(mean(rows.map((r) => r.precipitationMm)), 1),
    soilMoisturePercent: round(mean(rows.map((r) => r.soilMoisturePercent)), 1),
    ndvi: round(mean(rows.map((r) => r.ndvi)), 2),
    evapotranspirationMm: round(mean(rows.map((r) => r.evapotranspirationMm)), 1),
  }));
}
