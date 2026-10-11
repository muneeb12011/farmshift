import { clamp01, mean, round, sum } from '../lib/math.js';
import {
  anomalies,
  anomalyTrend,
  isoDate,
  parseIsoDate,
  tail,
  MS_DAY,
  type ClimateBundle,
  type DailyClimate,
} from './climate.js';
import type { EnvironmentSummary } from '../domain/schemas.js';

type Level = 'Low' | 'Moderate' | 'High' | 'Critical';

/**
 * Mean (or sum) of `get` over the same calendar window in each earlier year.
 * `endIdx` is the last index of the current window; years with <80% coverage are skipped.
 */
function historicalWindow(
  daily: readonly DailyClimate[],
  endIdx: number,
  days: number,
  get: (i: number) => number,
  agg: 'mean' | 'sum',
): number | null {
  const index = new Map<string, number>();
  daily.forEach((d, i) => index.set(d.date, i));
  const end = parseIsoDate(daily[endIdx]!.date);
  const results: number[] = [];
  for (let k = 1; k <= 12; k++) {
    const endK = Date.UTC(end.getUTCFullYear() - k, end.getUTCMonth(), end.getUTCDate());
    const vals: number[] = [];
    for (let j = 0; j < days; j++) {
      const idx = index.get(isoDate(endK - j * MS_DAY));
      if (idx !== undefined) vals.push(get(idx));
    }
    if (vals.length < days * 0.8) continue;
    results.push(agg === 'mean' ? mean(vals) : sum(vals) * (days / vals.length));
  }
  return results.length ? mean(results) : null;
}

export function waterStressLevel(score: number): Level {
  if (score < 0.25) return 'Low';
  if (score < 0.5) return 'Moderate';
  if (score < 0.75) return 'High';
  return 'Critical';
}

/** Build the dashboard summary from a climate bundle. All numbers are computed, none are canned. */
export function summarise(bundle: ClimateBundle, now: Date = new Date()): EnvironmentSummary {
  const { daily, ndvi } = bundle;
  const n = daily.length;
  const endIdx = n - 1;
  const warnings = [...bundle.provenance.warnings];
  const synthetic = bundle.provenance.climate.provider === 'synthetic';

  const last30 = tail(daily, 30);

  // --- temperature ---
  const tCur = mean(last30.map((d) => d.tMean));
  const tHist = historicalWindow(daily, endIdx, 30, (i) => daily[i]!.tMean, 'mean');
  const tAnomalySeries = anomalies(daily, daily.map((d) => d.tMean));

  // --- rainfall ---
  const pCur = sum(last30.map((d) => d.precip));
  const pHist = historicalWindow(daily, endIdx, 30, (i) => daily[i]!.precip, 'sum');
  const pctAnomaly = (cur: number, hist: number | null) => (hist !== null && hist >= 1 ? ((cur - hist) / hist) * 100 : 0);
  const pAnomPct = pctAnomaly(pCur, pHist);
  // Trend: compare how anomalous the last 30 days are with how anomalous the 30 days before were.
  let pTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (n >= 60 + 365) {
    const prevEnd = endIdx - 30;
    const prevCur = sum(daily.slice(prevEnd - 29, prevEnd + 1).map((d) => d.precip));
    const prevHist = historicalWindow(daily, prevEnd, 30, (i) => daily[i]!.precip, 'sum');
    const delta = pAnomPct - pctAnomaly(prevCur, prevHist);
    pTrend = delta > 20 ? 'increasing' : delta < -20 ? 'decreasing' : 'stable';
  }

  // --- soil moisture (root-zone wetness, %) ---
  const wCur = mean(tail(daily, 7).map((d) => d.soilWetness * 100));
  const wHist = historicalWindow(daily, endIdx, 7, (i) => daily[i]!.soilWetness * 100, 'mean');
  const wAnoms = anomalies(daily, daily.map((d) => d.soilWetness * 100));

  // --- vegetation ---
  const vCur = mean(tail(ndvi, 16));
  const vHist = historicalWindow(daily, endIdx, 16, (i) => ndvi[i]!, 'mean');
  const vAnoms = anomalies(daily, ndvi);

  if (tHist === null || pHist === null) {
    warnings.push('Less than one full year of history: anomalies and "historical" values fall back to current values.');
  }

  // --- water stress: transparent composite, documented in /api/v1/meta/sources ---
  const et0_30 = sum(last30.map((d) => d.et0));
  const wetnessDeficit = clamp01((0.55 - wCur / 100) / 0.35);
  const climaticDeficit = et0_30 > 0 ? clamp01(1 - pCur / et0_30) : 0;
  const dryAnomaly = clamp01(-pAnomPct / 60);
  const stressScore = 0.45 * wetnessDeficit + 0.35 * climaticDeficit + 0.2 * dryAnomaly;

  const climateSrc = synthetic ? 'Synthetic climate model (not observed)' : 'NASA POWER (MERRA-2 / CERES)';
  const vegSrc =
    bundle.provenance.vegetation.provider === 'modis-mod13q1'
      ? 'MODIS Terra MOD13Q1 NDVI (ORNL DAAC)'
      : 'Phenology model (estimated, not observed)';

  return {
    temperature: {
      current: round(tCur, 1),
      anomaly: round(tHist === null ? 0 : tCur - tHist, 1),
      trend: anomalyTrend(tAnomalySeries, 60, 0.4),
      historical: round(tHist ?? tCur, 1),
      source: climateSrc,
    },
    rainfall: {
      current: round(pCur, 0),
      anomalyPercent: round(pAnomPct, 0),
      trend: pTrend,
      historical: round(pHist ?? pCur, 0),
      source: synthetic ? climateSrc : 'NASA POWER (MERRA-2 corrected precipitation)',
    },
    soilMoisture: {
      current: round(wCur, 0),
      trend: anomalyTrend(wAnoms, 45, 2.5),
      historical: round(wHist ?? wCur, 0),
      source: synthetic ? climateSrc : 'NASA POWER GWETROOT (MERRA-2 root-zone wetness)',
    },
    vegetation: {
      current: round(vCur, 2),
      trend: anomalyTrend(vAnoms, 48, 0.03),
      historical: round(vHist ?? vCur, 2),
      source: vegSrc,
    },
    waterStress: {
      level: waterStressLevel(stressScore),
      score: round(stressScore, 2),
      source: 'Derived: FAO-56 ET0 balance + root-zone wetness + rainfall anomaly',
    },
    meta: {
      location: { lat: bundle.lat, lon: bundle.lon, elevationM: Math.round(bundle.elevationM) },
      period: { start: daily[0]!.date, end: daily[endIdx]!.date },
      generatedAt: now.toISOString(),
      climate: bundle.provenance.climate,
      vegetation: bundle.provenance.vegetation,
      warnings,
    },
  };
}

