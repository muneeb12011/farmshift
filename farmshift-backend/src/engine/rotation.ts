import { mustResolveCrop, type CropAgronomy } from '../domain/crops.js';
import type { FarmerPriorities, ScenarioMetrics } from '../domain/schemas.js';
import { clamp, clamp01, mean, round } from '../lib/math.js';
import { evaluateCropSlot, type CropSlotEval } from './crop-eval.js';
import type { FieldContext } from './field.js';

export interface RotationSlot {
  index: number;
  crop: CropAgronomy;
  eval: CropSlotEval;
  /** N credit inherited from the previous crop in the cycle (kg N/ha). */
  nCreditInKgHa: number;
  /** Fertiliser N still needed after credit (kg N/ha). */
  netNitrogenKgHa: number;
}

export interface RotationEvaluation {
  cropIds: string[];
  slots: RotationSlot[];
  metrics: ScenarioMetrics;
  /** Unrounded 0..100 versions used for ranking; `metrics` is the rounded display set. */
  raw: ScenarioMetrics;
  /** 0..100 composite helpers. */
  indices: {
    productivity: number;
    yieldStability: number;
    diseaseBreak: number; // 0..1
    nitrogenBalance: number; // 0..1
    rootDiversity: number; // 0..1
    groundCover: number; // 0..1
    droughtTolerance: number; // 0..1 weighted mean
  };
  detail: {
    meanEtcMm: number;
    meanIrrigationNeedMm: number;
    meanNetNitrogenKgHa: number;
    meanSupplyRatio: number;
    distinctCrops: number;
    distinctFamilies: number;
    aridityIndex: number;
  };
  /** Per-priority component scores (0..100) before weighting. */
  components: Record<keyof FarmerPriorities, number>;
  overall: number;
  warnings: string[];
}

/** Memoises per-crop slot evaluations: they depend on field and crop only, not on rotation order. */
export class SlotEvaluator {
  private cache = new Map<string, CropSlotEval>();
  constructor(public readonly field: FieldContext) {}
  get(crop: CropAgronomy): CropSlotEval {
    let e = this.cache.get(crop.id);
    if (!e) {
      e = evaluateCropSlot(crop, this.field);
      this.cache.set(crop.id, e);
    }
    return e;
  }
}

const WATER_REF_ETC = 900; // mm: ceiling for a very thirsty season (rice / cotton)
const WATER_REF_NIR = 700; // mm of irrigation need
const N_REF = 150; // kg N/ha

export function priorityWeights(p: FarmerPriorities): Record<keyof FarmerPriorities, number> {
  const total = Object.values(p).reduce((a, b) => a + b, 0);
  const keys = Object.keys(p) as (keyof FarmerPriorities)[];
  const w = {} as Record<keyof FarmerPriorities, number>;
  for (const k of keys) w[k] = total > 0 ? p[k] / total : 1 / keys.length;
  return w;
}

export function evaluateRotation(cropIds: readonly string[], ev: SlotEvaluator): RotationEvaluation {
  const field = ev.field;
  const L = cropIds.length;
  if (L < 1) throw new Error('A rotation needs at least one crop');
  const crops = cropIds.map(mustResolveCrop);

  const slots: RotationSlot[] = crops.map((crop, i) => {
    const prev = crops[(i - 1 + L) % L]!;
    const credit = prev.nCreditNextKgHa;
    const net = Math.max(0, crop.nDemandKgHa - credit);
    return { index: i, crop, eval: ev.get(crop), nCreditInKgHa: credit, netNitrogenKgHa: net };
  });

  const warnings: string[] = [];
  const soilN = field.profile.soil.nitrogen;
  const nSoilFactor = soilN === 'Low' ? 1.1 : soilN === 'High' ? 0.9 : 1;

  // ---- water ----
  const meanEtc = mean(slots.map((s) => s.eval.water.etcMm + s.crop.extraWaterMm));
  const meanNir = mean(slots.map((s) => s.eval.water.irrigationNeedMm));
  const waterDemand = 100 * clamp01(0.5 * (meanEtc / WATER_REF_ETC) + 0.5 * (meanNir / WATER_REF_NIR));

  // ---- nutrients ----
  const meanNet = mean(slots.map((s) => s.netNitrogenKgHa));
  const nutrientPressure = 100 * clamp01((meanNet * nSoilFactor) / N_REF);

  // ---- diversity ----
  const distinctCrops = new Set(cropIds).size;
  const families = new Set(crops.map((c) => c.family));
  const distinctFamilies = families.size;
  const cropDiversity = 100 * (0.15 + 0.85 * (0.6 * clamp01((distinctCrops - 1) / 3) + 0.4 * clamp01((distinctFamilies - 1) / 2)));

  // ---- pest / disease carry-over ----
  let penalty = 0;
  for (let i = 0; i < L; i++) {
    const a = crops[i]!;
    const b = crops[(i + 1) % L]!;
    if (a.family === b.family && a.family !== 'Mixed') penalty += 1;
    if (L >= 3) {
      const c = crops[(i + 2) % L]!;
      if (a.family === c.family && a.family !== 'Mixed' && a.family !== b.family) penalty += 0.35;
    }
  }
  const diseaseBreak = clamp01(1 - penalty / L);

  // ---- soil health ----
  const omInput = mean(crops.map((c) => c.residueOM));
  const nBal = clamp01(mean(crops.map((c) => c.nCreditNextKgHa)) / 25);
  const groundCover = mean(crops.map((c) => c.groundCover));
  const rootMids = crops.map((c) => (c.rootDepthM[0] + c.rootDepthM[1]) / 2);
  const rm = mean(rootMids);
  const rootSd = Math.sqrt(mean(rootMids.map((r) => (r - rm) ** 2)));
  const rootDiv = clamp01(rootSd / 0.35);
  const soilBase = 0.3 * omInput + 0.2 * nBal + 0.2 * groundCover + 0.1 * rootDiv + 0.2 * diseaseBreak;
  const omAdj = clamp((field.profile.soil.organicMatter - 2) * 3, -8, 8); // carbon-rich soils buffer, poor soils need more
  const soilHealth = clamp(100 * soilBase + omAdj, 0, 100);

  // ---- climate compatibility ----
  const climateCompat = 100 * mean(slots.map((s) => s.eval.suitability.compat));

  // ---- yield proxies ----
  const yieldTerm = (s: RotationSlot) =>
    s.crop.marketable ? s.eval.water.relativeYield * Math.sqrt(s.eval.suitability.temperature * s.eval.suitability.heat) : 0;
  const diseaseFactor = 0.85 + 0.15 * diseaseBreak;
  const productivity = 100 * mean(slots.map(yieldTerm)) * diseaseFactor;
  const marketable = slots.filter((s) => s.crop.marketable);
  const worst = marketable.length ? Math.min(...marketable.map(yieldTerm)) : 0;
  const yieldMean = marketable.length ? mean(marketable.map(yieldTerm)) : 0;
  const yieldStability = 100 * (0.5 * yieldMean + 0.5 * worst) * diseaseFactor;

  // ---- resilience ----
  const wD = 0.15 + 0.25 * field.aridity; // drought tolerance matters more where it is dry
  const droughtTol = mean(crops.map((c) => c.droughtTolerance));
  const meanSupply = mean(slots.map((s) => s.eval.water.supplyRatio));
  const meanHeat = mean(slots.map((s) => s.eval.suitability.heat));
  const resilience =
    100 * clamp01(wD * droughtTol + 0.25 * (cropDiversity / 100) + 0.2 * meanSupply + 0.1 * groundCover + 0.05 * rootDiv + (0.4 - wD) * meanHeat);

  const raw: ScenarioMetrics = {
    waterDemand,
    soilHealth,
    climateCompatibility: climateCompat,
    cropDiversity,
    nutrientPressure,
    environmentalResilience: resilience,
  };
  const metrics: ScenarioMetrics = {
    waterDemand: round(waterDemand),
    soilHealth: round(soilHealth),
    climateCompatibility: round(climateCompat),
    cropDiversity: round(cropDiversity),
    nutrientPressure: round(nutrientPressure),
    environmentalResilience: round(resilience),
  };

  // ---- priority-weighted overall ----
  const components: Record<keyof FarmerPriorities, number> = {
    waterConservation: 100 - waterDemand,
    soilHealth,
    yieldStability: 0.5 * productivity + 0.5 * yieldStability,
    climateResilience: 0.5 * climateCompat + 0.5 * resilience,
    cropDiversity,
    lowerInputRequirement: 0.7 * (100 - nutrientPressure) + 0.3 * (100 - waterDemand),
  };
  const w = priorityWeights(field.profile.priorities);
  let overall = (Object.keys(components) as (keyof FarmerPriorities)[]).reduce((s, k) => s + w[k] * components[k], 0);
  const weakSlots = slots.filter((s) => s.eval.water.relativeYield < 0.6).length;
  overall = clamp(overall - Math.min(15, 4 * weakSlots), 0, 100);

  // ---- warnings ----
  for (const s of slots) {
    const e = s.eval;
    if (!e.viable) warnings.push(`${s.crop.name}: not viable on this field (${describeFlags(e)}).`);
    else if (e.flags.includes('water-limited')) {
      warnings.push(
        `${s.crop.name}: needs ~${Math.round(e.water.irrigationNeedMm)} mm irrigation but supply covers only ${Math.round(e.water.supplyRatio * 100)}% of demand (relative yield ≈ ${Math.round(e.water.relativeYield * 100)}%).`,
      );
    }
    if (e.flags.includes('heat-stress-risk')) {
      warnings.push(`${s.crop.name}: ${Math.round(e.climate.heatFraction * 100)}% of season days exceed its ${s.crop.heatStressC} °C heat-stress threshold.`);
    }
    if (e.flags.includes('ph-mismatch')) warnings.push(`${s.crop.name}: soil pH ${field.profile.soil.ph} is outside its optimum ${s.crop.phOpt[0]}–${s.crop.phOpt[1]}.`);
    if (e.flags.includes('drainage-mismatch')) warnings.push(`${s.crop.name}: ${field.profile.soil.drainage.toLowerCase()} soil is a poor match for this crop.`);
  }
  if (diseaseBreak < 0.5) {
    warnings.push(
      L === 1
        ? 'Continuous cropping of one plant family: highest pest/disease carry-over risk.'
        : 'Consecutive crops share a plant family: higher pest/disease carry-over risk.',
    );
  }

  return {
    cropIds: crops.map((c) => c.id),
    slots,
    metrics,
    raw,
    indices: {
      productivity,
      yieldStability,
      diseaseBreak,
      nitrogenBalance: nBal,
      rootDiversity: rootDiv,
      groundCover,
      droughtTolerance: droughtTol,
    },
    detail: {
      meanEtcMm: meanEtc,
      meanIrrigationNeedMm: meanNir,
      meanNetNitrogenKgHa: meanNet,
      meanSupplyRatio: meanSupply,
      distinctCrops,
      distinctFamilies,
      aridityIndex: field.aridity,
    },
    components,
    overall: round(overall),
    warnings,
  };
}

export function describeFlags(e: CropSlotEval): string {
  const parts: string[] = [];
  if (e.flags.includes('water-limited')) parts.push(`water supply ${Math.round(e.water.supplyRatio * 100)}% of demand`);
  if (e.flags.includes('too-cool')) parts.push(`season mean ${e.climate.tMeanC.toFixed(1)} °C is too cool`);
  if (e.flags.includes('too-warm')) parts.push(`season mean ${e.climate.tMeanC.toFixed(1)} °C is too warm`);
  if (e.flags.includes('heat-stress-risk')) parts.push('frequent heat-stress days');
  return parts.length ? parts.join(', ') : 'multiple limiting factors';
}
