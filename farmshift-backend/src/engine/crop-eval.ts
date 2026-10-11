import { AWC_MM_PER_M, type CropAgronomy } from '../domain/crops.js';
import { clamp01, trapezoid } from '../lib/math.js';
import { effectiveRainWindow } from './et0.js';
import { windowStats } from './climate.js';
import { doyLabel, sowingDoy } from './season.js';
import type { FieldContext } from './field.js';

/** Seasonal irrigation water (mm) a farm can realistically apply, by system × availability. */
const IRRIGATION_CAP_MM: Record<string, Record<string, number>> = {
  Irrigated: { High: 900, Moderate: 500, Limited: 250 },
  Mixed: { High: 500, Moderate: 300, Limited: 150 },
  'Rain-fed': { High: 0, Moderate: 0, Limited: 0 },
};

export type SlotFlag =
  | 'water-limited'
  | 'heat-stress-risk'
  | 'too-cool'
  | 'too-warm'
  | 'ph-mismatch'
  | 'drainage-mismatch'
  | 'not-viable';

export interface CropSlotEval {
  cropId: string;
  cropName: string;
  window: { startDoy: number; days: number; label: string };
  climate: { tMeanC: number; heatFraction: number; precipMm: number; et0Mm: number; precipCv: number; windowYears: number };
  water: {
    etcMm: number;
    effectiveRainMm: number;
    soilStorageMm: number;
    irrigationCapMm: number;
    /** Irrigation required beyond effective rain and stored soil water. */
    irrigationNeedMm: number;
    /** Share of crop water demand that can be met (0..1). */
    supplyRatio: number;
    /** FAO-33 relative yield 1 − Ky(1 − supply). */
    relativeYield: number;
  };
  suitability: { temperature: number; heat: number; ph: number; drainage: number; compat: number };
  viable: boolean;
  flags: SlotFlag[];
}

export function evaluateCropSlot(crop: CropAgronomy, f: FieldContext): CropSlotEval {
  const { soil, waterAvailability, irrigationType } = f.profile;
  const startDoy = sowingDoy(crop, f.lat, f.monthly);
  const days = crop.growingDays;
  const w = windowStats(f.bundle.daily, startDoy, days, crop.heatStressC);

  // Degenerate data (should not happen with ≥1y of history): fall back to annual means.
  const tMean = w?.tMean ?? 20;
  const heatFraction = w?.heatFraction ?? 0;
  const precip = w?.precip ?? (f.annualPrecipMm * days) / 365;
  const et0 = w?.et0 ?? (f.annualEt0Mm * days) / 365;

  // --- water balance (FAO-56 single-Kc approach) ---
  const etc = et0 * crop.kcAvg;
  const demand = etc + crop.extraWaterMm;
  const effRain = Math.min(effectiveRainWindow(precip, days), demand);
  const awc = AWC_MM_PER_M[soil.soilType] ?? 130;
  const storage = awc * Math.min(crop.rootDepthM[1], 1.0) * 0.5; // readily available water at sowing (MAD ≈ 50%)
  const irrigationCap = IRRIGATION_CAP_MM[irrigationType]![waterAvailability]!;
  const irrigationNeed = Math.max(0, demand - effRain - storage);
  const supplyRatio = demand > 0 ? clamp01((effRain + storage + irrigationCap) / demand) : 1;
  const relativeYield = clamp01(1 - crop.ky * (1 - supplyRatio));

  // --- suitability ---
  const temperature = trapezoid(tMean, crop.temp.lo, crop.temp.optLo, crop.temp.optHi, crop.temp.hi);
  const heat = 1 - clamp01(heatFraction * 2.5);
  const [phLo, phHi] = crop.phOpt;
  const phDist = soil.ph < phLo ? phLo - soil.ph : soil.ph > phHi ? soil.ph - phHi : 0;
  const ph = phDist === 0 ? 1 : Math.max(0.4, 1 - (phDist / 2.5) * 0.6);

  let drainage = 1;
  if (crop.id === 'rice') drainage = soil.drainage === 'Poorly drained' ? 1 : soil.drainage === 'Moderately drained' ? 0.8 : 0.55;
  else if (soil.drainage === 'Poorly drained') drainage = 0.5 + 0.5 * crop.waterloggingTolerance;
  else if (soil.drainage === 'Moderately drained') drainage = 0.85 + 0.15 * crop.waterloggingTolerance;

  const compat = (0.45 * temperature + 0.3 * relativeYield + 0.15 * heat + 0.1 * ph) * (0.7 + 0.3 * drainage);
  const viable = relativeYield >= 0.4 && temperature >= 0.2;

  const flags: SlotFlag[] = [];
  if (!viable) flags.push('not-viable');
  if (relativeYield < 0.8) flags.push('water-limited');
  if (heatFraction > 0.15) flags.push('heat-stress-risk');
  if (temperature < 0.6) flags.push(tMean < crop.temp.optLo ? 'too-cool' : 'too-warm');
  if (ph < 0.8) flags.push('ph-mismatch');
  if (drainage < 0.8) flags.push('drainage-mismatch');

  return {
    cropId: crop.id,
    cropName: crop.name,
    window: { startDoy, days, label: `${doyLabel(startDoy)} + ${days} d` },
    climate: { tMeanC: tMean, heatFraction, precipMm: precip, et0Mm: et0, precipCv: w?.precipCv ?? 0, windowYears: w?.years ?? 0 },
    water: {
      etcMm: etc,
      effectiveRainMm: effRain,
      soilStorageMm: storage,
      irrigationCapMm: irrigationCap,
      irrigationNeedMm: irrigationNeed,
      supplyRatio,
      relativeYield,
    },
    suitability: { temperature, heat, ph, drainage, compat },
    viable,
    flags,
  };
}
