import { fetchJson } from '../lib/http.js';
import { AppError } from '../lib/errors.js';
import { clamp } from '../lib/math.js';
import { et0PenmanMonteith, extraterrestrialRadiation } from '../engine/et0.js';
import { dayOfYear, parseIsoDate, type DailyClimate } from '../engine/climate.js';

/**
 * NASA POWER daily point API (AG community, MERRA-2 / CERES derived).
 * Docs: https://power.larc.nasa.gov/docs/services/api/
 *
 * Parameters used: T2M, T2M_MAX, T2M_MIN (°C), PRECTOTCORR (mm/day), RH2M (%),
 * WS2M (m/s @ 2 m), ALLSKY_SFC_SW_DWN (MJ m-2 day-1 in the AG community), GWETROOT (0..1 root-zone wetness).
 * Missing values are encoded as -999.
 */
const PARAMS = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'RH2M', 'WS2M', 'ALLSKY_SFC_SW_DWN', 'GWETROOT'] as const;
type Param = (typeof PARAMS)[number];

interface PowerResponse {
  geometry?: { coordinates?: [number, number, number] };
  properties?: { parameter?: Partial<Record<Param, Record<string, number>>> };
  header?: { fill_value?: number };
}

export interface NasaFetchOptions {
  base: string;
  lat: number;
  lon: number;
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  end: string;
  timeoutMs: number;
  deadlineMs?: number;
  fetchImpl?: typeof fetch;
  retryBaseMs?: number;
}

const compact = (iso: string) => iso.replaceAll('-', '');
const expand = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;

export async function fetchNasaPowerDaily(o: NasaFetchOptions): Promise<{ daily: DailyClimate[]; elevationM: number }> {
  const qs = new URLSearchParams({
    parameters: PARAMS.join(','),
    community: 'AG',
    longitude: o.lon.toFixed(4),
    latitude: o.lat.toFixed(4),
    start: compact(o.start),
    end: compact(o.end),
    format: 'JSON',
  });
  const json = await fetchJson<PowerResponse>(`${o.base}?${qs}`, {
    timeoutMs: o.timeoutMs,
    deadlineMs: o.deadlineMs,
    label: 'NASA POWER',
    fetchImpl: o.fetchImpl,
    retryBaseMs: o.retryBaseMs,
    retries: 2,
  });
  return parsePowerResponse(json, o.lat);
}

export function parsePowerResponse(json: PowerResponse, lat: number): { daily: DailyClimate[]; elevationM: number } {
  const p = json.properties?.parameter;
  if (!p?.T2M || !p.PRECTOTCORR) {
    throw AppError.upstream('NASA POWER returned an unexpected payload (missing T2M / PRECTOTCORR)');
  }
  const fill = json.header?.fill_value ?? -999;
  const elevationM = clamp(json.geometry?.coordinates?.[2] ?? 0, -400, 6000);
  const valid = (v: number | undefined): v is number => v !== undefined && v !== fill && v > -900 && Number.isFinite(v);

  // Newest days are often not yet published (fill values). Only process up to the last day on which
  // both temperature and precipitation are valid, so gap-bridging below can never invent trailing data.
  const allDates = Object.keys(p.T2M).sort();
  let lastValid = -1;
  allDates.forEach((d, i) => {
    if (valid(p.T2M?.[d]) && valid(p.PRECTOTCORR?.[d])) lastValid = i;
  });
  const dates = allDates.slice(0, lastValid + 1);
  const daily: DailyClimate[] = [];
  // Last good value per variable, used to bridge isolated gaps (≤3 consecutive days).
  const last: Partial<Record<Param, { v: number; age: number }>> = {};

  const pick = (name: Param, date: string, maxGap = 3): number | undefined => {
    const v = p[name]?.[date];
    if (valid(v)) {
      last[name] = { v, age: 0 };
      return v;
    }
    const prev = last[name];
    if (prev && prev.age < maxGap) {
      prev.age += 1;
      return prev.v;
    }
    return undefined;
  };

  for (const d of dates) {
    const tMean = pick('T2M', d);
    const tMax = pick('T2M_MAX', d) ?? (tMean !== undefined ? tMean + 4 : undefined);
    const tMin = pick('T2M_MIN', d) ?? (tMean !== undefined ? tMean - 4 : undefined);
    const precip = pick('PRECTOTCORR', d, 0);
    // Trailing days not yet published come back as fill values: stop at the first incomplete day.
    if (tMean === undefined || tMax === undefined || tMin === undefined || precip === undefined) {
      if (daily.length > 0) break;
      continue;
    }
    const rh = pick('RH2M', d) ?? 55;
    const wind = pick('WS2M', d) ?? 2;
    const wetness = clamp(pick('GWETROOT', d) ?? 0.5, 0, 1);
    const date = expand(d);
    const doy = dayOfYear(parseIsoDate(date));
    let solar = pick('ALLSKY_SFC_SW_DWN', d);
    if (solar === undefined) {
      // Hargreaves radiation estimate when satellite radiation is unavailable.
      solar = 0.16 * Math.sqrt(Math.max(0.1, tMax - tMin)) * extraterrestrialRadiation(lat, doy);
    }
    const et0 = et0PenmanMonteith({ tMax, tMin, tMean, rh, u2: wind, rs: solar, latDeg: lat, doy, elevationM });
    daily.push({
      date,
      doy,
      tMean,
      tMax: Math.max(tMax, tMean),
      tMin: Math.min(tMin, tMean),
      precip: Math.max(0, precip),
      rh,
      wind,
      solar,
      soilWetness: wetness,
      et0,
    });
  }

  if (daily.length < 60) {
    throw AppError.upstream(`NASA POWER returned too little usable data (${daily.length} days)`);
  }
  return { daily, elevationM };
}
