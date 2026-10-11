import { clamp01, trapezoid } from '../lib/math.js';
import type { DailyClimate } from '../engine/climate.js';

/**
 * Phenology proxy for NDVI, used ONLY when observed MODIS data is unavailable (and always labelled
 * "estimated"). Vegetation vigour follows a 30-day smoothed growth-favourability index driven by
 * air temperature and root-zone wetness. It reproduces seasonal shape, not field-level greenness.
 */
export function estimateNdvi(daily: readonly DailyClimate[]): number[] {
  const NDVI_MIN = 0.2;
  const NDVI_MAX = 0.8;
  const alpha = 2 / (30 + 1);
  let ema = 0.5;
  return daily.map((d, i) => {
    const fT = trapezoid(d.tMean, 2, 14, 28, 40);
    const fW = Math.sqrt(clamp01(d.soilWetness / 0.6));
    const f = fT * fW;
    ema = i === 0 ? f : alpha * f + (1 - alpha) * ema;
    return NDVI_MIN + (NDVI_MAX - NDVI_MIN) * clamp01(ema);
  });
}
