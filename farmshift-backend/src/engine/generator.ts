import { CROPS, mustResolveCrop } from '../domain/crops.js';
import { evaluateRotation, type RotationEvaluation, type SlotEvaluator } from './rotation.js';
import type { GenerateOptions } from './types.js';

export interface Archetype {
  id: string;
  letter: string;
  label: string;
  key: 'balanced' | 'water' | 'soil' | 'diversity' | 'lowinput';
  blurb: string;
  objective: (e: RotationEvaluation) => number;
}

/** Each objective blends the archetype's own goal with the farmer's weighted overall score. */
export const ARCHETYPES: Archetype[] = [
  {
    id: 'scenario-a', letter: 'A', label: 'Balanced Productivity', key: 'balanced',
    blurb: 'Keeps marketable output and climate fit high while limiting nutrient pressure.',
    objective: (e) => 0.4 * (0.5 * e.indices.productivity + 0.5 * e.indices.yieldStability) + 0.3 * e.overall + 0.15 * e.raw.climateCompatibility + 0.15 * e.raw.soilHealth,
  },
  {
    id: 'scenario-b', letter: 'B', label: 'Water Resilient', key: 'water',
    blurb: 'Prioritises water conservation through low-demand, drought-tolerant crop choices.',
    objective: (e) => 0.45 * (100 - e.raw.waterDemand) + 0.25 * e.raw.climateCompatibility + 0.2 * e.raw.environmentalResilience + 0.1 * e.overall,
  },
  {
    id: 'scenario-c', letter: 'C', label: 'Soil Regenerative', key: 'soil',
    blurb: 'Maximises soil restoration through legumes, residue return and ground cover.',
    objective: (e) => 0.45 * e.raw.soilHealth + 0.25 * (100 - e.raw.nutrientPressure) + 0.15 * e.raw.cropDiversity + 0.15 * e.overall,
  },
  {
    id: 'scenario-d', letter: 'D', label: 'Diversified Resilience', key: 'diversity',
    blurb: 'Spreads risk across plant families and rooting depths.',
    objective: (e) => 0.4 * e.raw.cropDiversity + 0.35 * e.raw.environmentalResilience + 0.25 * e.overall,
  },
  {
    id: 'scenario-e', letter: 'E', label: 'Low-Input Efficient', key: 'lowinput',
    blurb: 'Minimises fertiliser and irrigation inputs per cycle.',
    objective: (e) => 0.4 * (100 - e.raw.nutrientPressure) + 0.3 * (100 - e.raw.waterDemand) + 0.3 * e.overall,
  },
];

const MAX_CANDIDATES = 30_000;

/** Canonical form of a cycle: lexicographically smallest rotation (a cycle has no privileged start). */
export function canonicalCycle(ids: readonly string[]): string {
  let best = '';
  for (let i = 0; i < ids.length; i++) {
    const rot = [...ids.slice(i), ...ids.slice(0, i)].join('>');
    if (best === '' || rot < best) best = rot;
  }
  return best;
}

export interface CandidateSet {
  candidates: RotationEvaluation[];
  warnings: string[];
  poolSize: number;
}

/** Enumerate all agronomically admissible rotations of `opts.length` crops. */
export function enumerateCandidates(ev: SlotEvaluator, opts: GenerateOptions): CandidateSet {
  const warnings: string[] = [];
  const current = ev.field.profile.currentCropId;
  const excluded = new Set(opts.excludeCrops.map((c) => mustResolveCrop(c).id));
  const forced = opts.mustInclude.map((c) => mustResolveCrop(c).id);

  // Pool: crops that are viable on this field (unless the user insists on one).
  const pool = CROPS.filter((c) => !excluded.has(c.id))
    .filter((c) => {
      const e = ev.get(c);
      if (e.viable) return true;
      if (forced.includes(c.id)) {
        warnings.push(`${c.name} was included on request although it is not viable on this field.`);
        return true;
      }
      return false;
    })
    .map((c) => c.id);

  if (opts.length > 1 && pool.length < 2) {
    return { candidates: [], warnings: [...warnings, 'Fewer than two viable crops: no rotation can be built for this field.'], poolSize: pool.length };
  }

  let anchor: string | null = null;
  if (opts.anchorCurrentCrop) {
    if (pool.includes(current)) anchor = current;
    else warnings.push(`Current crop (${mustResolveCrop(current).name}) is excluded or not viable here, so rotations are not anchored to it.`);
  }

  const out: RotationEvaluation[] = [];
  const seen = new Set<string>();
  const seq: string[] = [];

  // A crop may recur at most ceil(L/3) times per cycle, and a cover crop only once (agronomic sanity cap).
  const counts = new Map<string, number>();
  const maxRepeat = (id: string) => (mustResolveCrop(id).role === 'cover' ? 1 : Math.max(1, Math.ceil(opts.length / 3)));

  const visit = () => {
    if (out.length >= MAX_CANDIDATES) return;
    if (seq.length === opts.length) {
      if (opts.length > 1 && seq[seq.length - 1] === seq[0]) return; // cyclic closure: no identical neighbours
      if (forced.some((f) => !seq.includes(f))) return;
      const key = canonicalCycle(seq);
      if (!anchor && seen.has(key)) return;
      seen.add(key);
      out.push(evaluateRotation(seq, ev));
      return;
    }
    for (const id of pool) {
      if (seq.length > 0 && seq[seq.length - 1] === id) continue;
      if ((counts.get(id) ?? 0) >= maxRepeat(id)) continue;
      seq.push(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      visit();
      counts.set(id, counts.get(id)! - 1);
      seq.pop();
    }
  };

  if (anchor) {
    seq.push(anchor);
    counts.set(anchor, 1);
    visit();
    seq.pop();
  } else {
    visit();
  }

  if (out.length >= MAX_CANDIDATES) warnings.push(`Candidate space truncated at ${MAX_CANDIDATES} rotations.`);
  return { candidates: out, warnings, poolSize: pool.length };
}

export interface Picked {
  archetype: Archetype;
  evaluation: RotationEvaluation;
}

/** Choose one distinct rotation per archetype (distinct = different crop set). */
export function selectArchetypes(candidates: readonly RotationEvaluation[], count: number): { picks: Picked[]; warnings: string[] } {
  const picks: Picked[] = [];
  const usedSets = new Set<string>();
  const warnings: string[] = [];
  const setKey = (e: RotationEvaluation) => [...new Set(e.cropIds)].sort().join('+');

  for (const arch of ARCHETYPES.slice(0, Math.max(1, Math.min(5, count)))) {
    const ranked = [...candidates].sort((a, b) => {
      const d = arch.objective(b) - arch.objective(a);
      return Math.abs(d) > 1e-9 ? d : a.cropIds.join('>').localeCompare(b.cropIds.join('>'));
    });
    const choice = ranked.find((e) => !usedSets.has(setKey(e)));
    if (!choice) {
      warnings.push(`Only ${picks.length} sufficiently distinct rotation(s) exist for these constraints.`);
      break;
    }
    usedSets.add(setKey(choice));
    picks.push({ archetype: arch, evaluation: choice });
  }
  return { picks, warnings };
}
