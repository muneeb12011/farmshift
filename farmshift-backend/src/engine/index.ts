import { mustResolveCrop } from '../domain/crops.js';
import type { EnvironmentSummary, ResolvedProfile } from '../domain/schemas.js';
import type { ClimateBundle } from './climate.js';
import { buildFieldContext, ENGINE_VERSION, type FieldContext } from './field.js';
import { ARCHETYPES, enumerateCandidates, selectArchetypes, type Archetype } from './generator.js';
import { buildScenario } from './narrative.js';
import { evaluateRotation, SlotEvaluator } from './rotation.js';
import type { BaselineOut, GenerateOptions, ScenarioOut } from './types.js';
import { DEFAULT_GENERATE_OPTIONS } from './types.js';

export { ENGINE_VERSION } from './field.js';
export type { ScenarioOut, GenerateOptions, BaselineOut } from './types.js';
export { DEFAULT_GENERATE_OPTIONS } from './types.js';

export interface EngineInput {
  profile: ResolvedProfile;
  bundle: ClimateBundle;
  summary?: EnvironmentSummary;
}

export interface EngineResult {
  engineVersion: string;
  baseline: BaselineOut;
  scenarios: ScenarioOut[];
  warnings: string[];
  context: {
    annualPrecipMm: number;
    annualEt0Mm: number;
    aridityIndex: number;
    candidatesEvaluated: number;
    viableCrops: number;
  };
}

function dataSources(bundle: ClimateBundle): string[] {
  const src: string[] = [];
  src.push(bundle.provenance.climate.provider === 'nasa-power' ? 'NASA POWER (MERRA-2 / CERES)' : 'Synthetic climate model (not observed)');
  src.push('FAO-56 Penman-Monteith ET0');
  if (bundle.provenance.vegetation.provider === 'modis-mod13q1') src.push('MODIS MOD13Q1 NDVI');
  src.push('FAO-33 crop water response / built-in agronomy knowledge base');
  return src;
}

function baselineOf(field: FieldContext, ev: SlotEvaluator): { out: BaselineOut; evaluation: ReturnType<typeof evaluateRotation> } {
  const evaluation = evaluateRotation([field.profile.currentCropId], ev);
  return {
    evaluation,
    out: { crops: [mustResolveCrop(field.profile.currentCropId).name], metrics: evaluation.metrics, overallScore: evaluation.overall },
  };
}

export function generateScenarios(input: EngineInput, options: Partial<GenerateOptions> = {}): EngineResult {
  const opts: GenerateOptions = { ...DEFAULT_GENERATE_OPTIONS, ...options };
  const field = buildFieldContext(input.profile, input.bundle);
  const ev = new SlotEvaluator(field);
  const { evaluation: baseEval, out: baseline } = baselineOf(field, ev);

  const { candidates, warnings, poolSize } = enumerateCandidates(ev, opts);
  const { picks, warnings: pickWarnings } = selectArchetypes(candidates, opts.count);
  const sources = dataSources(input.bundle);

  const scenarios = picks.map((p) =>
    buildScenario({ archetype: p.archetype, ev: p.evaluation, baseline: baseEval, field, summary: input.summary, dataSources: sources }),
  );

  return {
    engineVersion: ENGINE_VERSION,
    baseline,
    scenarios,
    warnings: [...input.bundle.provenance.warnings, ...warnings, ...pickWarnings],
    context: {
      annualPrecipMm: Math.round(field.annualPrecipMm),
      annualEt0Mm: Math.round(field.annualEt0Mm),
      aridityIndex: Math.round(field.aridity * 100) / 100,
      candidatesEvaluated: candidates.length,
      viableCrops: poolSize,
    },
  };
}

const CUSTOM: Archetype = {
  id: 'custom',
  letter: 'X',
  label: 'Custom Rotation',
  key: 'balanced',
  blurb: 'Your own rotation, scored with the same engine.',
  objective: (e) => e.overall,
};

/** Score a user-built rotation (e.g. from the rotation builder) with the same model as generated ones. */
export function evaluateCustom(
  input: EngineInput,
  cropIds: string[],
): { baseline: BaselineOut; scenario: ScenarioOut; warnings: string[] } {
  const field = buildFieldContext(input.profile, input.bundle);
  const ev = new SlotEvaluator(field);
  const { evaluation: baseEval, out: baseline } = baselineOf(field, ev);
  const evaluation = evaluateRotation(cropIds, ev);
  const names = evaluation.slots.map((s) => s.crop.name).join(' → ');
  const scenario = buildScenario({
    archetype: CUSTOM,
    ev: evaluation,
    baseline: baseEval,
    field,
    summary: input.summary,
    id: 'custom',
    name: 'Custom Rotation',
    dataSources: dataSources(input.bundle),
  });
  scenario.description = `Custom cycle: ${names}.`;
  return { baseline, scenario, warnings: input.bundle.provenance.warnings };
}

export { ARCHETYPES };
