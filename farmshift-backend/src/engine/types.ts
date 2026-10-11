import type { ScenarioMetrics } from '../domain/schemas.js';

/** Frontend-compatible `RotationScenario` plus backend extras. */
export interface ScenarioOut {
  id: string;
  name: string;
  description: string;
  crops: string[];
  metrics: ScenarioMetrics;
  tradeoffs: { advantages: string[]; disadvantages: string[] };
  aiExplanation: string;
  tags: string[];
  overallScore: number;
  dataSourcesUsed: string[];

  // ---- backend extras ----
  archetype: string;
  /** Per-cycle detail: what each crop slot needs and gets on this field. */
  sequence: SlotOut[];
  insights: { whyThisMatters: string[] };
  /** Delta versus continuing the current crop (positive = higher value). */
  versusCurrent: ScenarioMetrics & { overallScore: number };
  warnings: string[];
  details: {
    meanIrrigationNeedMm: number;
    meanNetNitrogenKgHa: number;
    meanRelativeYield: number;
    diseaseBreak: number;
    productivityIndex: number;
  };
  narration: 'template' | 'llm';
}

export interface SlotOut {
  cycleIndex: number;
  crop: string;
  season: string;
  sowing: string;
  growingDays: number;
  seasonMeanTempC: number;
  seasonRainMm: number;
  cropWaterNeedMm: number;
  irrigationNeedMm: number;
  waterSupplyRatio: number;
  relativeYield: number;
  nitrogenCreditKgHa: number;
  netNitrogenKgHa: number;
  climateCompatibility: number;
  flags: string[];
}

export interface BaselineOut {
  crops: string[];
  metrics: ScenarioMetrics;
  overallScore: number;
}

export interface GenerateOptions {
  /** Cycle length in crops/seasons. */
  length: number;
  /** Number of scenarios to return (1..5). */
  count: number;
  /** Start every rotation with the field's current crop. */
  anchorCurrentCrop: boolean;
  excludeCrops: string[];
  mustInclude: string[];
}

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  length: 3,
  count: 3,
  anchorCurrentCrop: true,
  excludeCrops: [],
  mustInclude: [],
};
