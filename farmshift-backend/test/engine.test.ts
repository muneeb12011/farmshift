import { describe, expect, it } from 'vitest';
import { DEFAULT_PRIORITIES, DEFAULT_SOIL, type ResolvedProfile } from '../src/domain/schemas.js';
import { CROPS, resolveCrop, toCropInfo } from '../src/domain/crops.js';
import { evaluateCustom, generateScenarios, type ScenarioOut } from '../src/engine/index.js';
import { buildFieldContext } from '../src/engine/field.js';
import { evaluateRotation, SlotEvaluator } from '../src/engine/rotation.js';
import { doyLabel, sowingDoy } from '../src/engine/season.js';
import { summarise, waterStressLevel } from '../src/engine/summary.js';
import { enumerateCandidates, canonicalCycle } from '../src/engine/generator.js';
import { monthlyClimatology, type ClimateBundle } from '../src/engine/climate.js';
import { generateSyntheticClimate } from '../src/providers/synthetic.js';
import { estimateNdvi } from '../src/providers/ndvi-model.js';

function bundleAt(lat: number, lon: number, years = 4): ClimateBundle {
  const { daily, elevationM } = generateSyntheticClimate({ lat, lon, start: `${2026 - years}-01-01`, end: '2025-12-31' });
  return {
    lat,
    lon,
    elevationM,
    daily,
    ndvi: estimateNdvi(daily),
    provenance: { climate: { provider: 'synthetic', stale: false, fetchedAt: '2026-01-01T00:00:00Z' }, vegetation: { provider: 'phenology-model', quality: 'estimated' }, warnings: [] },
  };
}

const profile = (o: Partial<ResolvedProfile> = {}): ResolvedProfile => ({
  soil: DEFAULT_SOIL,
  currentCropId: 'wheat',
  waterAvailability: 'Moderate',
  irrigationType: 'Mixed',
  priorities: DEFAULT_PRIORITIES,
  ...o,
});

const evaluator = (p: ResolvedProfile, lat = 30.2, lon = 71.47) => new SlotEvaluator(buildFieldContext(p, bundleAt(lat, lon)));

describe('crop catalog', () => {
  it('matches the frontend catalog exactly (ids, display fields)', () => {
    expect(CROPS.map((c) => c.id)).toEqual(['wheat', 'maize', 'rice', 'soybean', 'millet', 'cotton', 'chickpea', 'barley', 'cover_crop']);
    expect(toCropInfo(resolveCrop('Cover Crop')!)).toEqual({ id: 'cover_crop', name: 'Cover Crop', waterDemand: 'Low', season: 'Year-round', rootingDepth: '0.3 - 1.0 m', nutrientDemand: 'Low', growingDays: 60, icon: 'Leaf', color: '#4EC4B1' });
  });
  it('resolves ids, names and loose forms; rejects unknowns', () => {
    for (const k of ['cover_crop', 'Cover Crop', 'cover crop', 'COVER-CROP']) expect(resolveCrop(k)?.id).toBe('cover_crop');
    expect(resolveCrop('quinoa')).toBeUndefined();
  });
  it('agronomic parameters are internally sane', () => {
    for (const c of CROPS) {
      expect(c.temp.lo).toBeLessThan(c.temp.optLo);
      expect(c.temp.optLo).toBeLessThan(c.temp.optHi);
      expect(c.temp.optHi).toBeLessThan(c.temp.hi);
      expect(c.phOpt[0]).toBeLessThan(c.phOpt[1]);
      expect(c.droughtTolerance).toBeGreaterThanOrEqual(0);
      expect(c.droughtTolerance).toBeLessThanOrEqual(1);
    }
    expect(CROPS.filter((c) => c.nCreditNextKgHa > 0).every((c) => c.family === 'Fabaceae' || c.family === 'Mixed')).toBe(true);
  });
});

describe('sowing windows', () => {
  const m = monthlyClimatology(bundleAt(30, 71).daily);
  const wheat = resolveCrop('wheat')!;
  const maize = resolveCrop('maize')!;
  it('subtropical north: Rabi ~1 Nov, Kharif ~15 Jun', () => {
    expect(sowingDoy(wheat, 30, m)).toBe(305);
    expect(sowingDoy(maize, 30, m)).toBe(166);
  });
  it('temperate north sows earlier for winter and summer crops', () => {
    expect(sowingDoy(wheat, 45, m)).toBe(283);
    expect(sowingDoy(maize, 45, m)).toBe(125);
  });
  it('southern hemisphere shifts the calendar by half a year', () => {
    expect(sowingDoy(wheat, -30, m)).toBe(((305 - 1 + 182) % 365) + 1);
  });
  it('equatorial seasons follow the rainfall', () => {
    const rain = { tMean: new Array(12).fill(25), et0: new Array(12).fill(100), precip: [20, 30, 150, 200, 180, 90, 20, 10, 20, 40, 120, 100] };
    // wettest 4-month block starts in March (index 2)
    expect(doyLabel(sowingDoy(maize, 0, rain))).toBe('Mar 01');
  });
});

describe('per-crop field evaluation', () => {
  it('rice is not viable on rain-fed land with limited water in a dry climate; viable when irrigated', () => {
    const rice = resolveCrop('rice')!;
    const dry = evaluator(profile({ irrigationType: 'Rain-fed', waterAvailability: 'Limited' })).get(rice);
    expect(dry.viable).toBe(false);
    expect(dry.flags).toContain('not-viable');
    expect(dry.water.irrigationCapMm).toBe(0);
    const wet = evaluator(profile({ irrigationType: 'Irrigated', waterAvailability: 'High', soil: { ...DEFAULT_SOIL, drainage: 'Poorly drained' } })).get(rice);
    expect(wet.water.supplyRatio).toBeGreaterThan(dry.water.supplyRatio);
    expect(wet.suitability.drainage).toBe(1);
  });
  it('more water access never lowers relative yield', () => {
    const maize = resolveCrop('maize')!;
    const levels: ResolvedProfile['waterAvailability'][] = ['Limited', 'Moderate', 'High'];
    const ys = levels.map((w) => evaluator(profile({ irrigationType: 'Irrigated', waterAvailability: w })).get(maize).water.relativeYield);
    expect(ys[1]!).toBeGreaterThanOrEqual(ys[0]!);
    expect(ys[2]!).toBeGreaterThanOrEqual(ys[1]!);
  });
  it('flags a pH mismatch', () => {
    const e = evaluator(profile({ soil: { ...DEFAULT_SOIL, ph: 4.2 } })).get(resolveCrop('wheat')!);
    expect(e.flags).toContain('ph-mismatch');
    expect(e.suitability.ph).toBeLessThan(0.8);
  });
  it('irrigation need can never be negative and supply ratio stays in [0,1]', () => {
    const ev = evaluator(profile());
    for (const c of CROPS) {
      const e = ev.get(c);
      expect(e.water.irrigationNeedMm).toBeGreaterThanOrEqual(0);
      expect(e.water.supplyRatio).toBeGreaterThanOrEqual(0);
      expect(e.water.supplyRatio).toBeLessThanOrEqual(1);
    }
  });
});

describe('rotation scoring invariants', () => {
  const ev = evaluator(profile());
  it('monoculture has minimum diversity and no disease break', () => {
    const r = evaluateRotation(['wheat'], ev);
    expect(r.metrics.cropDiversity).toBe(15);
    expect(r.indices.diseaseBreak).toBe(0);
    expect(r.warnings.some((w) => /Continuous cropping/.test(w))).toBe(true);
  });
  it('a legume phase lowers fertiliser pressure (cycle credit applies to the NEXT crop)', () => {
    const cereals = evaluateRotation(['wheat', 'maize'], ev);
    const legume = evaluateRotation(['wheat', 'chickpea'], ev);
    expect(legume.metrics.nutrientPressure).toBeLessThan(cereals.metrics.nutrientPressure);
    const slot = evaluateRotation(['chickpea', 'maize'], ev).slots[1]!;
    expect(slot.nCreditInKgHa).toBe(35);
    expect(slot.netNitrogenKgHa).toBe(160 - 35);
    // cyclic: credit wraps from last crop to first
    expect(evaluateRotation(['wheat', 'chickpea'], ev).slots[0]!.nCreditInKgHa).toBe(35);
  });
  it('same-family neighbours reduce the disease break', () => {
    expect(evaluateRotation(['wheat', 'chickpea', 'cotton'], ev).indices.diseaseBreak).toBeGreaterThan(evaluateRotation(['wheat', 'maize', 'barley'], ev).indices.diseaseBreak);
  });
  it('more families and crops raise diversity', () => {
    const a = evaluateRotation(['wheat', 'maize'], ev).metrics.cropDiversity;
    const b = evaluateRotation(['wheat', 'chickpea', 'cover_crop'], ev).metrics.cropDiversity;
    expect(b).toBeGreaterThan(a);
  });
  it('cover crops yield no marketable output but add soil benefits', () => {
    const cover = evaluateRotation(['cover_crop'], ev);
    expect(cover.indices.productivity).toBe(0);
    expect(cover.metrics.soilHealth).toBeGreaterThan(evaluateRotation(['cotton'], ev).metrics.soilHealth);
  });
  it('all metrics are integers in [0, 100]', () => {
    for (const ids of [['wheat'], ['rice', 'cotton'], ['maize', 'soybean', 'cover_crop'], ['millet', 'chickpea', 'barley', 'cover_crop']]) {
      const r = evaluateRotation(ids, ev);
      for (const v of [...Object.values(r.metrics), r.overall]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
  it('farmer priorities change the ranking of rotations', () => {
    const lowWater = ['wheat', 'chickpea', 'millet'];
    const highWater = ['wheat', 'cotton', 'maize'];
    const waterFirst = evaluator(profile({ priorities: { waterConservation: 10, soilHealth: 0, yieldStability: 0, climateResilience: 0, cropDiversity: 0, lowerInputRequirement: 0 } }));
    const a = evaluateRotation(lowWater, waterFirst);
    const b = evaluateRotation(highWater, waterFirst);
    expect(a.overall).toBeGreaterThan(b.overall);
    expect(a.components.waterConservation).toBeGreaterThan(b.components.waterConservation);
  });
  it('identical inputs give identical outputs (pure/deterministic)', () => {
    expect(JSON.stringify(evaluateRotation(['wheat', 'chickpea', 'cover_crop'], ev))).toBe(JSON.stringify(evaluateRotation(['wheat', 'chickpea', 'cover_crop'], evaluator(profile()))));
  });
  it('rejects an empty rotation', () => expect(() => evaluateRotation([], ev)).toThrow());
});

describe('scenario generation', () => {
  const bundle = bundleAt(30.2, 71.47);
  const run = (o = {}, p: Partial<ResolvedProfile> = {}) => generateScenarios({ profile: profile(p), bundle, summary: summarise(bundle) }, o);
  const ids = (s: ScenarioOut) => s.crops.map((n) => resolveCrop(n)!.id);

  it('returns distinct, anchored, cyclically-valid rotations', () => {
    const r = run({ count: 5 });
    expect(r.scenarios).toHaveLength(5);
    const sets = new Set(r.scenarios.map((s) => [...new Set(ids(s))].sort().join('+')));
    expect(sets.size).toBe(5);
    for (const s of r.scenarios) {
      const c = ids(s);
      expect(c[0]).toBe('wheat'); // anchored on the current crop
      expect(c).toHaveLength(3);
      for (let i = 0; i < c.length; i++) expect(c[i]).not.toBe(c[(i + 1) % c.length]);
    }
    expect(r.scenarios.map((s) => s.id)).toEqual(['scenario-a', 'scenario-b', 'scenario-c', 'scenario-d', 'scenario-e']);
  });
  it('is deterministic', () => expect(JSON.stringify(run())).toBe(JSON.stringify(run())));
  it('honours excludeCrops, mustInclude and length', () => {
    const r = run({ excludeCrops: ['cover_crop', 'Cotton'], mustInclude: ['chickpea'], length: 4 });
    for (const s of r.scenarios) {
      expect(s.crops).toHaveLength(4);
      expect(ids(s)).toContain('chickpea');
      expect(ids(s)).not.toContain('cover_crop');
      expect(ids(s)).not.toContain('cotton');
    }
  });
  it('caps repeats: a cover crop at most once; others at most ceil(L/3)', () => {
    const { candidates } = enumerateCandidates(evaluator(profile()), { length: 5, count: 3, anchorCurrentCrop: true, excludeCrops: [], mustInclude: [] });
    expect(candidates.length).toBeGreaterThan(100);
    for (const c of candidates) {
      const count = (id: string) => c.cropIds.filter((x) => x === id).length;
      expect(count('cover_crop')).toBeLessThanOrEqual(1);
      expect(Math.max(...CROPS.map((k) => count(k.id)))).toBeLessThanOrEqual(2);
    }
  });
  it('unanchored enumeration de-duplicates rotations of the same cycle', () => {
    expect(canonicalCycle(['a', 'b', 'c'])).toBe(canonicalCycle(['b', 'c', 'a']));
    expect(canonicalCycle(['a', 'b', 'c'])).not.toBe(canonicalCycle(['a', 'c', 'b']));
    const { candidates } = enumerateCandidates(evaluator(profile()), { length: 3, count: 3, anchorCurrentCrop: false, excludeCrops: [], mustInclude: [] });
    const keys = candidates.map((c) => canonicalCycle(c.cropIds));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('current crop that is not viable is not forced as the anchor, with an explanation', () => {
    const r = run({}, { currentCropId: 'rice', irrigationType: 'Rain-fed', waterAvailability: 'Limited' });
    expect(r.warnings.join(' ')).toMatch(/not anchored/);
    expect(r.scenarios.length).toBeGreaterThan(0);
  });
  it('every scenario is internally consistent and free of broken text', () => {
    for (const s of run({ count: 5 }).scenarios) {
      const text = JSON.stringify([s.description, s.aiExplanation, s.tradeoffs, s.insights, s.warnings]);
      expect(text).not.toMatch(/undefined|NaN|Infinity|null/);
      expect(s.tradeoffs.advantages.length).toBeGreaterThanOrEqual(2);
      expect(s.tradeoffs.disadvantages.length).toBeGreaterThanOrEqual(2);
      expect(s.insights.whyThisMatters).toHaveLength(4);
      expect(s.tags.length).toBeGreaterThan(0);
      expect(s.tags.length).toBeLessThanOrEqual(4);
      expect(s.sequence).toHaveLength(s.crops.length);
      expect(s.dataSourcesUsed.join(' ')).toMatch(/Synthetic/);
      expect(s.versusCurrent.overallScore).toBe(s.overallScore - run().baseline.overallScore);
      for (const slot of s.sequence) {
        expect(slot.relativeYield).toBeGreaterThanOrEqual(0);
        expect(slot.relativeYield).toBeLessThanOrEqual(1);
        expect(slot.climateCompatibility).toBeLessThanOrEqual(100);
      }
    }
  });
  it('the explanation never claims a water saving that the numbers do not show', () => {
    for (const s of run({ count: 5 }).scenarios.filter((x) => x.archetype === 'water')) {
      const claims = /(\d+)% less than/.exec(s.aiExplanation);
      if (claims) expect(s.versusCurrent.waterDemand).toBeLessThanOrEqual(0);
    }
  });
  it('baseline equals continuous current crop', () => {
    const r = run();
    expect(r.baseline.crops).toEqual(['Wheat']);
    const ev = evaluator(profile());
    expect(r.baseline.metrics).toEqual(evaluateRotation(['wheat'], ev).metrics);
  });
  it('evaluateCustom scores a user rotation with the same engine (and does not reorder it)', () => {
    const out = evaluateCustom({ profile: profile(), bundle, summary: summarise(bundle) }, ['wheat', 'cover_crop', 'chickpea']);
    expect(out.scenario.id).toBe('custom');
    expect(out.scenario.crops).toEqual(['Wheat', 'Cover Crop', 'Chickpea']);
    const gen = run({ count: 5 }).scenarios.find((s) => ids(s).join() === 'wheat,cover_crop,chickpea');
    if (gen) expect(out.scenario.metrics).toEqual(gen.metrics);
  });
});

describe('environment summary', () => {
  const b = bundleAt(34.02, 71.58, 5);
  const s = summarise(b, new Date('2026-01-01T00:00:00Z'));
  it('produces values in physical ranges with the frontend shape', () => {
    expect(s.temperature.current).toBeGreaterThan(-30);
    expect(s.temperature.current).toBeLessThan(50);
    expect(s.rainfall.current).toBeGreaterThanOrEqual(0);
    expect(s.soilMoisture.current).toBeGreaterThanOrEqual(0);
    expect(s.soilMoisture.current).toBeLessThanOrEqual(100);
    expect(s.vegetation.current).toBeGreaterThanOrEqual(0.2);
    expect(['increasing', 'decreasing', 'stable']).toContain(s.temperature.trend);
    expect(['Low', 'Moderate', 'High', 'Critical']).toContain(s.waterStress.level);
    expect(s.temperature.anomaly).toBeCloseTo(s.temperature.current - s.temperature.historical, 0);
  });
  it('labels synthetic sources honestly', () => {
    expect(s.temperature.source).toMatch(/Synthetic/);
    expect(s.vegetation.source).toMatch(/estimated/);
    expect(s.meta!.warnings).toBeDefined();
  });
  it('water stress thresholds', () => {
    expect([0.1, 0.3, 0.6, 0.9].map(waterStressLevel)).toEqual(['Low', 'Moderate', 'High', 'Critical']);
  });
  it('warns when there is under a year of history', () => {
    const short = { ...b, daily: b.daily.slice(-200), ndvi: b.ndvi.slice(-200) };
    const ss = summarise(short);
    expect(ss.meta!.warnings.join(' ')).toMatch(/Less than one full year/);
    expect(ss.temperature.anomaly).toBe(0);
  });
});
