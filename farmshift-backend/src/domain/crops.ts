import type { CropInfo } from './schemas.js';

/**
 * Agronomic knowledge base.
 *
 * Display fields (id … color) are identical to the frontend's mock catalog. The remaining parameters
 * are first-order values drawn from FAO-56 (crop coefficients), FAO Irrigation & Drainage Paper 33
 * (yield-response factor Ky), FAO EcoCrop-style temperature ranges and standard extension N budgets.
 * They are deliberately coarse: the engine ranks rotations, it does not predict yields.
 */
export interface CropAgronomy extends CropInfo {
  family: 'Poaceae' | 'Fabaceae' | 'Malvaceae' | 'Mixed';
  /** FAO-56 season-average crop coefficient (Kc). */
  kcAvg: number;
  /** FAO-33 seasonal yield response factor to water deficit. */
  ky: number;
  /** Season-mean air temperature response: 0 at tLo/tHi, 1 on [tOptLo, tOptHi]. */
  temp: { lo: number; optLo: number; optHi: number; hi: number };
  /** Daily Tmax above which reproductive/grain-fill stress becomes likely (°C). */
  heatStressC: number;
  /** Typical fertiliser N requirement for a good crop (kg N / ha). */
  nDemandKgHa: number;
  /** Net N credit the following crop receives (kg N / ha); legumes and legume-bearing covers. */
  nCreditNextKgHa: number;
  /** 0..1 tolerance to water deficit (used with local aridity). */
  droughtTolerance: number;
  /** Optimal soil pH band. */
  phOpt: [number, number];
  /** 0..1 soil-surface protection (erosion control). */
  groundCover: number;
  /** 0..1 organic-matter input via residue/roots. */
  residueOM: number;
  /** Extra water beyond ET (puddling, percolation) in mm per season. */
  extraWaterMm: number;
  rootDepthM: [number, number];
  /** 0..1 tolerance to waterlogging / poor drainage. */
  waterloggingTolerance: number;
  /** False for cover crops: contributes soil benefits but no sellable yield. */
  marketable: boolean;
  /** Longer hint shown in narratives. */
  role: 'cereal' | 'legume' | 'fibre' | 'cover';
}

export const CROPS: readonly CropAgronomy[] = [
  {
    id: 'wheat', name: 'Wheat', waterDemand: 'Medium', season: 'Rabi (Winter)', rootingDepth: '1.0 - 1.5 m',
    nutrientDemand: 'Medium', growingDays: 120, icon: 'Wheat', color: '#E7B75B',
    family: 'Poaceae', kcAvg: 0.82, ky: 1.05, temp: { lo: 2, optLo: 10, optHi: 22, hi: 32 }, heatStressC: 32,
    nDemandKgHa: 120, nCreditNextKgHa: 0, droughtTolerance: 0.5, phOpt: [6.0, 7.5], groundCover: 0.7,
    residueOM: 0.7, extraWaterMm: 0, rootDepthM: [1.0, 1.5], waterloggingTolerance: 0.3, marketable: true, role: 'cereal',
  },
  {
    id: 'maize', name: 'Maize', waterDemand: 'High', season: 'Kharif (Summer)', rootingDepth: '1.0 - 1.7 m',
    nutrientDemand: 'High', growingDays: 100, icon: 'Sprout', color: '#F59E0B',
    family: 'Poaceae', kcAvg: 0.85, ky: 1.25, temp: { lo: 8, optLo: 18, optHi: 30, hi: 38 }, heatStressC: 35,
    nDemandKgHa: 160, nCreditNextKgHa: 0, droughtTolerance: 0.35, phOpt: [5.8, 7.2], groundCover: 0.5,
    residueOM: 0.85, extraWaterMm: 0, rootDepthM: [1.0, 1.7], waterloggingTolerance: 0.25, marketable: true, role: 'cereal',
  },
  {
    id: 'rice', name: 'Rice', waterDemand: 'High', season: 'Kharif (Summer)', rootingDepth: '0.5 - 0.6 m',
    nutrientDemand: 'High', growingDays: 135, icon: 'Leaf', color: '#86EFAC',
    family: 'Poaceae', kcAvg: 1.1, ky: 1.09, temp: { lo: 15, optLo: 22, optHi: 30, hi: 36 }, heatStressC: 35,
    nDemandKgHa: 120, nCreditNextKgHa: 0, droughtTolerance: 0.1, phOpt: [5.5, 7.0], groundCover: 0.6,
    residueOM: 0.65, extraWaterMm: 350, rootDepthM: [0.5, 0.6], waterloggingTolerance: 1.0, marketable: true, role: 'cereal',
  },
  {
    id: 'soybean', name: 'Soybean', waterDemand: 'Medium', season: 'Kharif (Summer)', rootingDepth: '0.6 - 1.3 m',
    nutrientDemand: 'Low', growingDays: 100, icon: 'Bean', color: '#65C18C',
    family: 'Fabaceae', kcAvg: 0.85, ky: 0.85, temp: { lo: 10, optLo: 20, optHi: 30, hi: 36 }, heatStressC: 35,
    nDemandKgHa: 20, nCreditNextKgHa: 40, droughtTolerance: 0.45, phOpt: [6.0, 7.0], groundCover: 0.5,
    residueOM: 0.5, extraWaterMm: 0, rootDepthM: [0.6, 1.3], waterloggingTolerance: 0.4, marketable: true, role: 'legume',
  },
  {
    id: 'millet', name: 'Millet', waterDemand: 'Low', season: 'Kharif (Summer)', rootingDepth: '1.0 - 2.0 m',
    nutrientDemand: 'Low', growingDays: 75, icon: 'Sprout', color: '#D4A574',
    family: 'Poaceae', kcAvg: 0.7, ky: 0.8, temp: { lo: 12, optLo: 24, optHi: 35, hi: 42 }, heatStressC: 40,
    nDemandKgHa: 50, nCreditNextKgHa: 0, droughtTolerance: 0.9, phOpt: [5.5, 7.5], groundCover: 0.5,
    residueOM: 0.55, extraWaterMm: 0, rootDepthM: [1.0, 2.0], waterloggingTolerance: 0.2, marketable: true, role: 'cereal',
  },
  {
    id: 'cotton', name: 'Cotton', waterDemand: 'High', season: 'Kharif (Summer)', rootingDepth: '1.0 - 1.7 m',
    nutrientDemand: 'High', growingDays: 160, icon: 'Flower2', color: '#F5F5F5',
    family: 'Malvaceae', kcAvg: 0.9, ky: 0.85, temp: { lo: 15, optLo: 24, optHi: 32, hi: 40 }, heatStressC: 38,
    nDemandKgHa: 140, nCreditNextKgHa: 0, droughtTolerance: 0.5, phOpt: [6.0, 8.0], groundCover: 0.35,
    residueOM: 0.4, extraWaterMm: 0, rootDepthM: [1.0, 1.7], waterloggingTolerance: 0.2, marketable: true, role: 'fibre',
  },
  {
    id: 'chickpea', name: 'Chickpea', waterDemand: 'Low', season: 'Rabi (Winter)', rootingDepth: '0.6 - 1.0 m',
    nutrientDemand: 'Low', growingDays: 95, icon: 'Bean', color: '#C4A35A',
    family: 'Fabaceae', kcAvg: 0.7, ky: 0.7, temp: { lo: 5, optLo: 15, optHi: 26, hi: 35 }, heatStressC: 33,
    nDemandKgHa: 15, nCreditNextKgHa: 35, droughtTolerance: 0.8, phOpt: [6.0, 8.0], groundCover: 0.45,
    residueOM: 0.35, extraWaterMm: 0, rootDepthM: [0.6, 1.0], waterloggingTolerance: 0.1, marketable: true, role: 'legume',
  },
  {
    id: 'barley', name: 'Barley', waterDemand: 'Low', season: 'Rabi (Winter)', rootingDepth: '1.0 - 1.5 m',
    nutrientDemand: 'Medium', growingDays: 110, icon: 'Wheat', color: '#A3BE8C',
    family: 'Poaceae', kcAvg: 0.78, ky: 1.0, temp: { lo: 2, optLo: 10, optHi: 22, hi: 32 }, heatStressC: 32,
    nDemandKgHa: 80, nCreditNextKgHa: 0, droughtTolerance: 0.65, phOpt: [6.0, 8.0], groundCover: 0.7,
    residueOM: 0.6, extraWaterMm: 0, rootDepthM: [1.0, 1.5], waterloggingTolerance: 0.2, marketable: true, role: 'cereal',
  },
  {
    id: 'cover_crop', name: 'Cover Crop', waterDemand: 'Low', season: 'Year-round', rootingDepth: '0.3 - 1.0 m',
    nutrientDemand: 'Low', growingDays: 60, icon: 'Leaf', color: '#4EC4B1',
    family: 'Mixed', kcAvg: 0.7, ky: 0.3, temp: { lo: 2, optLo: 8, optHi: 28, hi: 38 }, heatStressC: 40,
    nDemandKgHa: 0, nCreditNextKgHa: 30, droughtTolerance: 0.7, phOpt: [5.5, 8.0], groundCover: 0.95,
    residueOM: 0.9, extraWaterMm: 0, rootDepthM: [0.3, 1.0], waterloggingTolerance: 0.5, marketable: false, role: 'cover',
  },
];

const byId = new Map(CROPS.map((c) => [c.id, c]));
const byName = new Map(CROPS.map((c) => [c.name.toLowerCase(), c]));

/** Resolve a crop by id ("cover_crop"), display name ("Cover Crop") or loose form ("cover crop"). */
export function resolveCrop(idOrName: string): CropAgronomy | undefined {
  const key = idOrName.trim();
  return (
    byId.get(key.toLowerCase()) ??
    byId.get(key.toLowerCase().replace(/[\s-]+/g, '_')) ??
    byName.get(key.toLowerCase())
  );
}

export function mustResolveCrop(idOrName: string): CropAgronomy {
  const c = resolveCrop(idOrName);
  if (!c) throw new Error(`Unknown crop "${idOrName}"`);
  return c;
}

export const CROP_IDS = CROPS.map((c) => c.id);

/** Strip agronomy internals: the exact frontend `CropInfo` shape. */
export function toCropInfo(c: CropAgronomy): CropInfo {
  return {
    id: c.id,
    name: c.name,
    waterDemand: c.waterDemand,
    season: c.season,
    rootingDepth: c.rootingDepth,
    nutrientDemand: c.nutrientDemand,
    growingDays: c.growingDays,
    icon: c.icon,
    color: c.color,
  };
}

/** Plant-available water capacity by texture (mm of water per m of soil), standard FAO-56 Table 19 ranges. */
export const AWC_MM_PER_M: Record<string, number> = {
  'Sandy Loam': 100,
  Clay: 150,
  Silt: 200,
  Loam: 160,
  'Clay Loam': 170,
  'Sandy Clay': 130,
};
