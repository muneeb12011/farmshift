import { fetchJson } from '../lib/http.js';
import { AppError } from '../lib/errors.js';
import { MS_DAY, isoDate } from '../engine/climate.js';

/**
 * Observed NDVI from MODIS Terra MOD13Q1 (250 m, 16-day composites) via the ORNL DAAC REST subset service.
 * Docs: https://modis.ornl.gov/data/modis_webservice.html
 *
 * The service is public but rate-limited and caps the number of composites per request, so we
 * request ≤10 composites at a time and fetch chunks with bounded concurrency.
 */
const PRODUCT = 'MOD13Q1';
const NDVI_BAND = '250m_16_days_NDVI';
const CHUNK = 10;

export interface NdviComposite {
  /** Calendar date of the composite start, YYYY-MM-DD. */
  date: string;
  ndvi: number;
}

interface SubsetRow {
  band?: string;
  calendar_date?: string;
  modis_date?: string;
  data?: number[];
}
interface SubsetResponse {
  subset?: SubsetRow[];
  scale?: string | number;
}

/** MOD13Q1 composites start on DOY 1, 17, 33 … 353 each year (23 per year, reset on Jan 1). */
export function compositeDates(startIso: string, endIso: string): { modis: string; iso: string }[] {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  const out: { modis: string; iso: string }[] = [];
  const y0 = new Date(start).getUTCFullYear();
  const y1 = new Date(end).getUTCFullYear();
  for (let y = y0; y <= y1; y++) {
    for (let doy = 1; doy <= 353; doy += 16) {
      const t = Date.UTC(y, 0, 1) + (doy - 1) * MS_DAY;
      if (t < start - 16 * MS_DAY || t > end) continue;
      out.push({ modis: `A${y}${String(doy).padStart(3, '0')}`, iso: isoDate(t) });
    }
  }
  return out;
}

export interface ModisFetchOptions {
  base: string;
  lat: number;
  lon: number;
  start: string;
  end: string;
  timeoutMs: number;
  deadlineMs?: number;
  concurrency?: number;
  fetchImpl?: typeof fetch;
  retryBaseMs?: number;
}

export async function fetchModisNdvi(o: ModisFetchOptions): Promise<NdviComposite[]> {
  const dates = compositeDates(o.start, o.end);
  if (dates.length === 0) return [];
  const chunks: typeof dates[] = [];
  for (let i = 0; i < dates.length; i += CHUNK) chunks.push(dates.slice(i, i + CHUNK));

  const results: NdviComposite[] = [];
  let cursor = 0;
  let failures = 0;
  const workers = Array.from({ length: o.concurrency ?? 3 }, async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor++]!;
      const qs = new URLSearchParams({
        latitude: o.lat.toFixed(5),
        longitude: o.lon.toFixed(5),
        startDate: chunk[0]!.modis,
        endDate: chunk[chunk.length - 1]!.modis,
        kmAboveBelow: '0',
        kmLeftRight: '0',
      });
      try {
        const json = await fetchJson<SubsetResponse>(`${o.base}/${PRODUCT}/subset?${qs}`, {
          timeoutMs: o.timeoutMs,
          deadlineMs: o.deadlineMs,
          label: 'MODIS (ORNL DAAC)',
          fetchImpl: o.fetchImpl,
          retryBaseMs: o.retryBaseMs,
          retries: 1,
        });
        results.push(...parseSubset(json));
      } catch {
        failures += 1;
      }
    }
  });
  await Promise.all(workers);

  if (results.length === 0) {
    throw AppError.upstream(`MODIS returned no NDVI composites (${failures}/${chunks.length} requests failed)`);
  }
  return results.sort((a, b) => a.date.localeCompare(b.date));
}

export function parseSubset(json: SubsetResponse): NdviComposite[] {
  const rows = json.subset;
  if (!Array.isArray(rows)) throw AppError.upstream('MODIS returned an unexpected payload (no subset array)');
  const scale = Number(json.scale ?? 0.0001) || 0.0001;
  const out: NdviComposite[] = [];
  for (const r of rows) {
    if (r.band && r.band !== NDVI_BAND) continue;
    const raw = r.data?.[0];
    // -3000 is the fill value; valid NDVI is -2000..10000 (scaled by 1e-4).
    if (raw === undefined || raw < -2000 || raw > 10_000) continue;
    const date = r.calendar_date ?? undefined;
    if (!date) continue;
    out.push({ date, ndvi: Math.min(1, Math.max(-0.2, raw * scale)) });
  }
  return out;
}
