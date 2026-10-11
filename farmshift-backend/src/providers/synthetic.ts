import { clamp, clamp01, gaussian, hashString, mulberry32 } from '../lib/math.js';
import { et0PenmanMonteith, extraterrestrialRadiation } from '../engine/et0.js';
import { MS_DAY, dayOfYear, isoDate, type DailyClimate } from '../engine/climate.js';

/**
 * Deterministic synthetic climate for offline development, tests and as the last-resort fallback
 * when upstream providers are unreachable. It is a plausible latitude-driven climate generator
 * (seasonal temperature, wet/dry-season rainfall, persistent soil wetness), NOT observed data,
 * and every response built from it carries `provider: "synthetic"` and a warning.
 */
export function generateSyntheticClimate(opts: {
  lat: number;
  lon: number;
  start: string;
  end: string;
}): { daily: DailyClimate[]; elevationM: number } {
  const { lat, lon } = opts;
  const seedBase = hashString(`${lat.toFixed(1)}:${lon.toFixed(1)}`);
  const rand = mulberry32(seedBase);
  const absLat = Math.abs(lat);

  // Location "personality" from a stable hash, centred on latitude-typical values.
  const continentality = 0.6 + 0.8 * mulberry32(seedBase ^ 0x9e3779b9)();
  const wetBase = absLat < 10 ? 0.62 : absLat < 25 ? 0.38 : 0.45;
  const wetness = clamp(wetBase + (mulberry32(seedBase ^ 0x85ebca6b)() - 0.5) * 0.5, 0.05, 0.95); // 0 arid .. 1 humid
  const elevationM = Math.round(mulberry32(seedBase ^ 0xc2b2ae35)() * 600);

  // Annual mean temperature: quadratic latitude gradient, subtropical dry-belt warm bump, lapse rate.
  const subtropicalBump = 4 * Math.exp(-(((absLat - 27) / 9) ** 2)) * (1 - wetness);
  const tAnnual = 28 - 0.0095 * absLat ** 2 + subtropicalBump - 0.0065 * elevationM;
  const amplitude = (1.5 + 0.26 * absLat) * continentality; // seasonal half-range
  const hemi = lat >= 0 ? 1 : -1;
  const dtr = 8 + 6 * (1 - wetness); // diurnal temperature range
  const annualP = 250 + 1500 * wetness ** 1.5; // mm/yr
  // Tropics/subtropics: single monsoon-like wet season (NH mid-year, SH year-end); mid-latitudes: mild seasonality.
  const wetPeakDoy = hemi > 0 ? 200 : 20;
  const seasonalP = absLat < 30 ? 0.85 : 0.35;

  const start = Date.parse(`${opts.start}T00:00:00Z`);
  const end = Date.parse(`${opts.end}T00:00:00Z`);
  const daily: DailyClimate[] = [];

  let anomaly = 0; // AR(1) temperature anomaly
  let soilW = 0.4 + 0.3 * wetness;
  let wetState = 0.5; // persistent weather regime for rain clustering

  for (let t = start; t <= end; t += MS_DAY) {
    const date = new Date(t);
    const doy = dayOfYear(date);
    const phase = (2 * Math.PI * (doy - 200)) / 365; // NH warmest ≈ day 200
    const season = Math.cos(hemi > 0 ? phase : phase + Math.PI);

    anomaly = 0.75 * anomaly + gaussian(rand) * 1.4;
    const tMean = tAnnual + amplitude * season + anomaly;

    // Rain: Markov-like clustering with seasonal wet-season modulation.
    const wetSeason = 1 + seasonalP * Math.cos((2 * Math.PI * (doy - wetPeakDoy)) / 365);
    wetState = clamp01(0.7 * wetState + 0.3 * rand());
    const pWet = clamp01((annualP / 365 / 8) * wetSeason * (0.5 + wetState));
    let precip = 0;
    if (rand() < pWet) precip = -Math.log(1 - rand() * 0.999) * (annualP / 365 / Math.max(0.05, pWet)) * 0.9;
    precip = clamp(precip, 0, 180);

    const cloud = clamp01(precip / 12 + 0.25 * rand());
    const ra = extraterrestrialRadiation(lat, doy);
    const solar = Math.max(1, ra * (0.75 - 0.5 * cloud));
    const tMax = tMean + (dtr / 2) * (1 - 0.5 * cloud);
    const tMin = tMean - (dtr / 2) * (1 - 0.5 * cloud);
    const rh = clamp(45 + 40 * wetness + 25 * cloud - 0.8 * (tMax - tMin) + gaussian(rand) * 4, 15, 98);
    const wind = clamp(2 + gaussian(rand) * 0.7, 0.4, 7);

    const et0 = et0PenmanMonteith({ tMax, tMin, tMean, rh, u2: wind, rs: solar, latDeg: lat, doy, elevationM });

    // Single-bucket root zone (≈250 mm storage): rain refills, ET depletes (water-limited below 50% wetness).
    const etActual = et0 * 0.7 * Math.min(1, soilW / 0.5);
    soilW = clamp(soilW + (precip * 0.9 - etActual) / 250, 0.05, 1);

    daily.push({
      date: isoDate(t),
      doy,
      tMean,
      tMax,
      tMin,
      precip,
      rh,
      wind,
      solar,
      soilWetness: soilW,
      et0,
    });
  }
  return { daily, elevationM };
}
