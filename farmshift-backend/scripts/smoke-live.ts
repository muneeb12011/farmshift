/**
 * Live connectivity check for the real upstream providers. Run from a machine with internet access:
 *   npm run smoke:live [-- lat lon]
 * Exercises NASA POWER and MODIS exactly as the server does and prints what came back, so a change in
 * either upstream's response format is caught here rather than in production.
 */
import { loadEnv } from '../src/config/env.js';
import { fetchNasaPowerDaily } from '../src/providers/nasa-power.js';
import { fetchModisNdvi } from '../src/providers/modis-ndvi.js';
import { MS_DAY, isoDate } from '../src/engine/climate.js';

const env = loadEnv();
const lat = Number(process.argv[2] ?? 30.2);
const lon = Number(process.argv[3] ?? 71.47);
const end = isoDate(Date.now() - 3 * MS_DAY);
const start = isoDate(Date.now() - 120 * MS_DAY);
let failed = false;

console.log(`Point ${lat}, ${lon}  window ${start} → ${end}\n`);

try {
  const t0 = Date.now();
  const { daily, elevationM } = await fetchNasaPowerDaily({ base: env.NASA_POWER_BASE, lat, lon, start, end, timeoutMs: env.UPSTREAM_TIMEOUT_MS });
  const last = daily[daily.length - 1]!;
  console.log(`NASA POWER  OK  ${daily.length} days, elevation ${elevationM} m, last day ${last.date}, ${Date.now() - t0} ms`);
  console.log(`            last day: T ${last.tMean.toFixed(1)} °C, P ${last.precip.toFixed(1)} mm, wetness ${last.soilWetness.toFixed(2)}, ET0 ${last.et0.toFixed(2)} mm`);
} catch (e) {
  failed = true;
  console.error('NASA POWER  FAIL', (e as Error).message);
}

try {
  const t0 = Date.now();
  const comps = await fetchModisNdvi({ base: env.MODIS_BASE, lat, lon, start, end, timeoutMs: 15_000 });
  console.log(`MODIS NDVI  OK  ${comps.length} composites, latest ${comps.at(-1)?.date} = ${comps.at(-1)?.ndvi.toFixed(3)}, ${Date.now() - t0} ms`);
} catch (e) {
  failed = true;
  console.error('MODIS NDVI  FAIL', (e as Error).message, '\n            (the server falls back to a labelled phenology estimate in this case)');
}

process.exit(failed ? 1 : 0);
