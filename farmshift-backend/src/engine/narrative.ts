import { mustResolveCrop } from '../domain/crops.js';
import type { EnvironmentSummary, FarmerPriorities, ScenarioMetrics } from '../domain/schemas.js';
import { mean, round } from '../lib/math.js';
import { describeFlags, priorityWeights, type RotationEvaluation } from './rotation.js';
import type { Archetype } from './generator.js';
import type { FieldContext } from './field.js';
import type { ScenarioOut, SlotOut } from './types.js';

const PRIORITY_LABEL: Record<keyof FarmerPriorities, string> = {
  waterConservation: 'water conservation',
  soilHealth: 'soil health',
  yieldStability: 'yield stability',
  climateResilience: 'climate resilience',
  cropDiversity: 'crop diversity',
  lowerInputRequirement: 'lower input requirement',
};

const METRIC_LABEL: Record<keyof ScenarioMetrics, string> = {
  waterDemand: 'water demand',
  soilHealth: 'soil health',
  climateCompatibility: 'climate compatibility',
  cropDiversity: 'crop diversity',
  nutrientPressure: 'nutrient pressure',
  environmentalResilience: 'environmental resilience',
};

const pct = (x: number) => Math.round(x * 100);
const mm = (x: number) => Math.round(x);
const joinNames = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export interface NarrativeInput {
  archetype: Archetype;
  ev: RotationEvaluation;
  baseline: RotationEvaluation;
  field: FieldContext;
  summary?: EnvironmentSummary;
  id?: string;
  name?: string;
  dataSources: string[];
}

export function slotsOut(ev: RotationEvaluation): SlotOut[] {
  return ev.slots.map((s) => ({
    cycleIndex: s.index + 1,
    crop: s.crop.name,
    season: s.crop.season,
    sowing: s.eval.window.label,
    growingDays: s.eval.window.days,
    seasonMeanTempC: round(s.eval.climate.tMeanC, 1),
    seasonRainMm: mm(s.eval.climate.precipMm),
    cropWaterNeedMm: mm(s.eval.water.etcMm + s.crop.extraWaterMm),
    irrigationNeedMm: mm(s.eval.water.irrigationNeedMm),
    waterSupplyRatio: round(s.eval.water.supplyRatio, 2),
    relativeYield: round(s.eval.water.relativeYield, 2),
    nitrogenCreditKgHa: Math.round(s.nCreditInKgHa),
    netNitrogenKgHa: Math.round(s.netNitrogenKgHa),
    climateCompatibility: pct(s.eval.suitability.compat),
    flags: s.eval.flags,
  }));
}

/** Tags describe what a scenario does *better than the current plan*, so they stay discriminating. Max 4. */
export function deriveTags(ev: RotationEvaluation, base: RotationEvaluation): string[] {
  const m = ev.raw;
  const b = base.raw;
  const tags: string[] = [];
  const baseNir = base.detail.meanIrrigationNeedMm;
  const waterBetter = baseNir >= 30 ? ev.detail.meanIrrigationNeedMm <= 0.75 * baseNir : b.waterDemand - m.waterDemand >= 10;
  if (waterBetter) tags.push('Water Saver');
  if (ev.slots.some((s) => s.crop.nCreditNextKgHa > 0)) tags.push('Nitrogen Fixer');
  if (m.soilHealth >= 70 && m.soilHealth - b.soilHealth >= 15) tags.push('Soil Builder');
  if (m.nutrientPressure <= 40 && b.nutrientPressure - m.nutrientPressure >= 15) tags.push('Low Input');
  if (m.climateCompatibility >= 75 && m.environmentalResilience >= 70 && m.environmentalResilience - b.environmentalResilience >= 5) tags.push('Climate Resilient');
  if (ev.slots.some((s) => s.crop.role === 'cover')) tags.push('Erosion Control');
  if (m.cropDiversity >= 75) tags.push('Diversified');
  const positives = [100 - m.waterDemand, m.soilHealth, m.climateCompatibility, m.cropDiversity, 100 - m.nutrientPressure, m.environmentalResilience];
  if (tags.length <= 2 && Math.max(...positives) - Math.min(...positives) <= 28 && ev.overall >= 55) tags.unshift('Balanced');
  return tags.length ? tags.slice(0, 4) : ['Mixed Profile'];
}

function tradeoffs(ev: RotationEvaluation, base: RotationEvaluation, field: FieldContext) {
  const adv: string[] = [];
  const dis: string[] = [];
  const cur = mustResolveCrop(field.profile.currentCropId).name;
  const L = ev.slots.length;

  // ---- advantages ----
  if (base.detail.meanIrrigationNeedMm >= 50 && ev.detail.meanIrrigationNeedMm < base.detail.meanIrrigationNeedMm * 0.9) {
    const cut = Math.round((1 - ev.detail.meanIrrigationNeedMm / base.detail.meanIrrigationNeedMm) * 100);
    adv.push(`Cuts mean irrigation need by about ${cut}% versus continuous ${cur} (${mm(base.detail.meanIrrigationNeedMm)} to ${mm(ev.detail.meanIrrigationNeedMm)} mm per crop)`);
  } else if (base.metrics.waterDemand - ev.metrics.waterDemand >= 10) {
    adv.push(`Water-demand index drops from ${base.metrics.waterDemand} to ${ev.metrics.waterDemand} versus continuous ${cur}`);
  }
  const legumeSlot = ev.slots.find((s) => s.crop.nCreditNextKgHa > 0);
  if (legumeSlot) {
    const next = ev.slots[(legumeSlot.index + 1) % L]!;
    adv.push(`${legumeSlot.crop.name} leaves roughly ${legumeSlot.crop.nCreditNextKgHa} kg N/ha of nitrogen credit for the following ${next.crop.name}`);
  }
  if (base.detail.meanNetNitrogenKgHa - ev.detail.meanNetNitrogenKgHa >= 20) {
    adv.push(`Average fertiliser N need falls from ${Math.round(base.detail.meanNetNitrogenKgHa)} to ${Math.round(ev.detail.meanNetNitrogenKgHa)} kg N/ha`);
  }
  if (ev.metrics.soilHealth - base.metrics.soilHealth >= 15) {
    adv.push(`Soil-health index rises from ${base.metrics.soilHealth} to ${ev.metrics.soilHealth} through residue return, ground cover and a pest/disease break`);
  }
  if (ev.slots.some((s) => s.crop.role === 'cover')) adv.push('Cover-crop phase protects the surface from erosion and adds organic matter');
  const deep = ev.slots.find((s) => s.crop.rootDepthM[1] >= 1.7);
  if (deep && ev.indices.rootDiversity > 0.3) adv.push(`Rooting-depth contrast (${deep.crop.name} to ${deep.crop.rootDepthM[1]} m) improves soil structure and reaches deeper moisture`);
  if (ev.detail.distinctFamilies >= 3) adv.push(`${ev.detail.distinctCrops} crops across ${ev.detail.distinctFamilies} plant families break pest and disease cycles`);
  if (ev.metrics.climateCompatibility >= 70) adv.push(`Strong local climate fit: ${ev.metrics.climateCompatibility}% average seasonal compatibility`);

  // ---- disadvantages ----
  const nonMarket = ev.slots.filter((s) => !s.crop.marketable);
  if (nonMarket.length) dis.push(`${joinNames(nonMarket.map((s) => s.crop.name))} phase produces no marketable yield`);
  for (const s of ev.slots) {
    if (s.eval.water.irrigationNeedMm >= 400) {
      const cover = pct(s.eval.water.supplyRatio);
      dis.push(`${s.crop.name} phase needs about ${mm(s.eval.water.irrigationNeedMm)} mm of irrigation (${cover}% of crop demand can be supplied)`);
    }
  }
  for (const s of ev.slots) {
    if (s.netNitrogenKgHa >= 110) dis.push(`${s.crop.name} phase still needs about ${Math.round(s.netNitrogenKgHa)} kg N/ha after rotation credit`);
  }
  if (ev.detail.distinctFamilies <= 2) dis.push(`Only ${ev.detail.distinctFamilies} plant famil${ev.detail.distinctFamilies === 1 ? 'y' : 'ies'}: limited diversification`);
  if (ev.indices.productivity < base.indices.productivity - 5) {
    dis.push(`Lower marketable-output potential than continuous ${cur} (index ${Math.round(ev.indices.productivity)} vs ${Math.round(base.indices.productivity)})`);
  }
  for (const s of ev.slots) {
    if (s.eval.flags.includes('heat-stress-risk')) dis.push(`${s.crop.name} faces heat stress on ${pct(s.eval.climate.heatFraction)}% of season days`);
    if (s.eval.flags.includes('ph-mismatch')) dis.push(`${s.crop.name} is a poor pH match (soil pH ${field.profile.soil.ph})`);
  }
  if (ev.indices.diseaseBreak < 0.5) dis.push('Neighbouring crops share a plant family: higher pest/disease carry-over');
  if (L >= 3) dis.push(`Requires a ${L}-crop planning commitment`);

  // Always return at least two of each, drawn from the strongest/weakest dimensions.
  const entries = (Object.entries(ev.raw) as [keyof ScenarioMetrics, number][]).map(([k, v]) => ({
    k,
    good: k === 'waterDemand' || k === 'nutrientPressure' ? 100 - v : v,
    shown: Math.round(v),
  }));
  const best = [...entries].sort((a, b) => b.good - a.good);
  const worst = [...entries].sort((a, b) => a.good - b.good);
  for (const e of best) if (adv.length < 2) adv.push(`Strong ${METRIC_LABEL[e.k]} (${e.shown}/100)`);
  for (const e of worst) if (dis.length < 2) dis.push(`Weakest dimension: ${METRIC_LABEL[e.k]} (${e.shown}/100)`);

  return { advantages: adv.slice(0, 4), disadvantages: dis.slice(0, 4) };
}

function topPriorities(field: FieldContext): { names: [string, string]; share: number } {
  const p = field.profile.priorities;
  const w = priorityWeights(p);
  const sorted = (Object.keys(p) as (keyof FarmerPriorities)[]).sort((a, b) => p[b] - p[a]);
  const [a, b] = sorted as [keyof FarmerPriorities, keyof FarmerPriorities];
  return { names: [PRIORITY_LABEL[a], PRIORITY_LABEL[b]], share: w[a] + w[b] };
}

function whyThisMatters(ev: RotationEvaluation, field: FieldContext, summary?: EnvironmentSummary): string[] {
  const out: string[] = [];
  const { waterAvailability, irrigationType } = field.profile;
  if (summary) {
    const cur = summary.soilMoisture.current;
    const hist = summary.soilMoisture.historical;
    if (cur < hist - 3) out.push(`Root-zone soil moisture is ${cur}%, below the ${hist}% seasonal norm.`);
    else if (cur > hist + 3) out.push(`Root-zone soil moisture is ${cur}%, above the ${hist}% seasonal norm.`);
    else out.push(`Root-zone soil moisture is ${cur}%, close to the ${hist}% seasonal norm.`);
  } else {
    out.push(`Local climate (${mm(field.annualPrecipMm)} mm rain vs ${mm(field.annualEt0Mm)} mm reference ET per year) sets every crop's water balance.`);
  }
  const cap = ev.slots[0]!.eval.water.irrigationCapMm;
  out.push(`Water availability is ${waterAvailability.toLowerCase()} on ${irrigationType.toLowerCase()} land, capping irrigation near ${cap} mm per crop.`);
  const tp = topPriorities(field);
  out.push(`Your top priorities, ${tp.names[0]} and ${tp.names[1]}, carry ${pct(tp.share)}% of the overall score.`);
  out.push(
    ev.detail.distinctFamilies > 1
      ? `${ev.detail.distinctCrops} crops from ${ev.detail.distinctFamilies} plant families reduce pest and disease carry-over.`
      : 'A single plant family keeps pest and disease pressure high.',
  );
  return out;
}

export function templateExplanation(i: NarrativeInput): string {
  const { ev, baseline: base, field, archetype } = i;
  const cur = mustResolveCrop(field.profile.currentCropId).name;
  const parts: string[] = [];

  switch (archetype.key) {
    case 'water': {
      const baseNir = base.detail.meanIrrigationNeedMm;
      const nir = ev.detail.meanIrrigationNeedMm;
      if (baseNir >= 50 && nir < baseNir * 0.95) {
        parts.push(
          `Water is the main lever: this cycle needs about ${mm(nir)} mm of irrigation per crop on average, ${Math.round((1 - nir / baseNir) * 100)}% less than the ${mm(baseNir)} mm for continuous ${cur}.`,
        );
      } else if (baseNir >= 50) {
        parts.push(
          `Water savings are modest on this field: mean irrigation need is ${mm(nir)} mm per crop versus ${mm(baseNir)} mm for continuous ${cur}. This cycle is chosen for drought tolerance (${pct(ev.indices.droughtTolerance)}% average) and resilience rather than a large cut in demand.`,
        );
      } else {
        parts.push(
          `Rainfall and stored soil water already cover most crop water demand here, so continuous ${cur} needs only ${mm(baseNir)} mm of irrigation; this cycle needs ${mm(nir)} mm per crop and is chosen for drought tolerance and resilience.`,
        );
      }
      break;
    }
    case 'soil':
      parts.push(
        `This cycle is built around soil health: ground cover averages ${pct(ev.indices.groundCover)}% and the soil-health index moves from ${base.metrics.soilHealth} (continuous ${cur}) to ${ev.metrics.soilHealth}.`,
      );
      break;
    case 'diversity':
      parts.push(`This cycle spreads risk across ${ev.detail.distinctCrops} crops and ${ev.detail.distinctFamilies} plant families, lifting the diversity index from ${base.metrics.cropDiversity} to ${ev.metrics.cropDiversity}.`);
      break;
    case 'lowinput':
      parts.push(`This cycle minimises purchased inputs: about ${Math.round(ev.detail.meanNetNitrogenKgHa)} kg N/ha and ${mm(ev.detail.meanIrrigationNeedMm)} mm irrigation per crop on average.`);
      break;
    default: {
      const marketable = ev.slots.filter((s) => s.crop.marketable);
      const yp = marketable.length ? mean(marketable.map((s) => s.eval.water.relativeYield)) : 0;
      parts.push(`This cycle balances output and risk: marketable crops reach about ${pct(yp)}% of unstressed yield on this field's water supply, with ${ev.metrics.climateCompatibility}% climate compatibility.`);
    }
  }

  const legume = ev.slots.find((s) => s.crop.nCreditNextKgHa > 0);
  if (legume) {
    parts.push(
      `${legume.crop.name} supplies about ${legume.crop.nCreditNextKgHa} kg N/ha to the next crop, pulling average fertiliser need to ${Math.round(ev.detail.meanNetNitrogenKgHa)} kg N/ha (continuous ${cur}: ${Math.round(base.detail.meanNetNitrogenKgHa)}).`,
    );
  } else {
    parts.push(`Average fertiliser need is ${Math.round(ev.detail.meanNetNitrogenKgHa)} kg N/ha per crop (continuous ${cur}: ${Math.round(base.detail.meanNetNitrogenKgHa)}), with no legume nitrogen credit in this cycle.`);
  }

  const weakest = [...ev.slots].sort((a, b) => a.eval.suitability.compat - b.eval.suitability.compat)[0]!;
  parts.push(
    weakest.eval.flags.length
      ? `${weakest.crop.name} is the weakest fit at ${pct(weakest.eval.suitability.compat)}% compatibility: ${describeFlags(weakest.eval)}.`
      : `${weakest.crop.name} is the weakest fit but still reaches ${pct(weakest.eval.suitability.compat)}% compatibility, with no limiting flags.`,
  );

  const tp = topPriorities(field);
  parts.push(`Scored against your priorities (${tp.names[0]}, ${tp.names[1]}), it rates ${ev.overall}/100 versus ${base.overall}/100 for continuous ${cur}.`);
  return parts.join(' ');
}

export function buildScenario(i: NarrativeInput): ScenarioOut {
  const { ev, baseline, archetype, field, summary } = i;
  const cropNames = ev.slots.map((s) => s.crop.name);
  const vs = {} as ScenarioOut['versusCurrent'];
  for (const k of Object.keys(ev.metrics) as (keyof ScenarioMetrics)[]) vs[k] = ev.metrics[k] - baseline.metrics[k];
  vs.overallScore = ev.overall - baseline.overall;
  const marketable = ev.slots.filter((s) => s.crop.marketable);

  return {
    id: i.id ?? archetype.id,
    name: i.name ?? `Scenario ${archetype.letter}: ${archetype.label}`,
    description: `${archetype.blurb} Cycle: ${cropNames.join(' → ')} (${cropNames.length}-crop rotation).`,
    crops: cropNames,
    metrics: ev.metrics,
    tradeoffs: tradeoffs(ev, baseline, field),
    aiExplanation: templateExplanation(i),
    tags: deriveTags(ev, baseline),
    overallScore: ev.overall,
    dataSourcesUsed: i.dataSources,
    archetype: archetype.key,
    sequence: slotsOut(ev),
    insights: { whyThisMatters: whyThisMatters(ev, field, summary) },
    versusCurrent: vs,
    warnings: ev.warnings,
    details: {
      meanIrrigationNeedMm: mm(ev.detail.meanIrrigationNeedMm),
      meanNetNitrogenKgHa: Math.round(ev.detail.meanNetNitrogenKgHa),
      meanRelativeYield: round(marketable.length ? mean(marketable.map((s) => s.eval.water.relativeYield)) : 0, 2),
      diseaseBreak: round(ev.indices.diseaseBreak, 2),
      productivityIndex: Math.round(ev.indices.productivity),
    },
    narration: 'template',
  };
}
