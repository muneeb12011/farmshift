import type { Env } from '../config/env.js';
import { fetchJson } from '../lib/http.js';
import type { EnvironmentSummary } from '../domain/schemas.js';
import type { BaselineOut, ScenarioOut } from '../engine/types.js';

/**
 * Optional LLM narration. The engine owns every number; the model only rephrases them.
 * Output is accepted only if (a) it parses as the expected JSON and (b) every number it mentions
 * appears in the facts we supplied. Anything else falls back to the deterministic template text.
 */
export interface NarrationFacts {
  scenario: Pick<ScenarioOut, 'name' | 'crops' | 'metrics' | 'versusCurrent' | 'details' | 'sequence' | 'warnings' | 'tradeoffs' | 'overallScore'>;
  baseline: BaselineOut;
  environment?: Pick<EnvironmentSummary, 'temperature' | 'rainfall' | 'soilMoisture' | 'vegetation' | 'waterStress'>;
}

export interface NarrationResult {
  aiExplanation: string;
  whyThisMatters: string[];
}

export interface Narrator {
  readonly enabled: boolean;
  narrate(facts: NarrationFacts): Promise<NarrationResult | null>;
}

export class NullNarrator implements Narrator {
  readonly enabled = false;
  async narrate(): Promise<null> {
    return null;
  }
}

const SYSTEM = `You explain crop-rotation analysis results to farmers in plain, specific language.
Rules:
- Use ONLY the facts in the JSON provided. Never invent, estimate or round to new numbers.
- Every number you write must appear verbatim in the JSON (percentages may be written as given).
- Do not give guarantees about yield or profit; these are model-based estimates.
- Reply with a single JSON object and nothing else: {"aiExplanation": string (3-5 sentences), "whyThisMatters": string[] (exactly 4 short sentences)}.`;

export function extractNumbers(text: string): number[] {
  return [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

function collectNumbers(x: unknown, out: Set<number>) {
  if (typeof x === 'number' && Number.isFinite(x)) {
    out.add(x);
    out.add(Math.round(x));
    out.add(Math.round(x * 10) / 10);
    out.add(Math.round(x * 100)); // fractions quoted as percentages
    out.add(Math.abs(x));
  } else if (Array.isArray(x)) x.forEach((v) => collectNumbers(v, out));
  else if (x && typeof x === 'object') Object.values(x).forEach((v) => collectNumbers(v, out));
}

/** True when every number in `text` is derivable from `facts` (small counts ≤ 12 are always allowed). */
export function isGrounded(text: string, facts: unknown): boolean {
  const allowed = new Set<number>();
  collectNumbers(facts, allowed);
  return extractNumbers(text).every((n) => (Number.isInteger(n) && Math.abs(n) <= 12) || [...allowed].some((a) => Math.abs(a - n) < 0.051));
}

export class AnthropicNarrator implements Narrator {
  readonly enabled = true;
  constructor(
    private env: Pick<Env, 'ANTHROPIC_API_KEY' | 'ANTHROPIC_MODEL' | 'ANTHROPIC_BASE'>,
    private fetchImpl?: typeof fetch,
  ) {}

  async narrate(facts: NarrationFacts): Promise<NarrationResult | null> {
    try {
      const res = await fetchJson<{ content?: { type: string; text?: string }[] }>(`${this.env.ANTHROPIC_BASE}/v1/messages`, {
        method: 'POST',
        timeoutMs: 15_000,
        retries: 0,
        label: 'Anthropic API',
        fetchImpl: this.fetchImpl,
        headers: { 'x-api-key': this.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: {
          model: this.env.ANTHROPIC_MODEL,
          max_tokens: 700,
          system: SYSTEM,
          messages: [{ role: 'user', content: JSON.stringify(facts) }],
        },
      });
      const text = res.content?.find((c) => c.type === 'text')?.text ?? '';
      const json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()) as Partial<NarrationResult>;
      if (typeof json.aiExplanation !== 'string' || !Array.isArray(json.whyThisMatters) || json.whyThisMatters.length !== 4) return null;
      if (!json.whyThisMatters.every((s) => typeof s === 'string')) return null;
      const joined = [json.aiExplanation, ...json.whyThisMatters].join(' ');
      if (!isGrounded(joined, facts)) return null;
      return { aiExplanation: json.aiExplanation.trim(), whyThisMatters: json.whyThisMatters.map((s) => s.trim()) };
    } catch {
      return null;
    }
  }
}

export function createNarrator(env: Env, fetchImpl?: typeof fetch): Narrator {
  return env.ANTHROPIC_API_KEY ? new AnthropicNarrator(env, fetchImpl) : new NullNarrator();
}

/** Apply LLM narration to scenarios in place-safe fashion; returns copies and whether any text changed. */
export async function applyNarration(
  narrator: Narrator,
  scenarios: ScenarioOut[],
  baseline: BaselineOut,
  environment?: NarrationFacts['environment'],
): Promise<ScenarioOut[]> {
  if (!narrator.enabled) return scenarios;
  return Promise.all(
    scenarios.map(async (s) => {
      const r = await narrator.narrate({
        scenario: { name: s.name, crops: s.crops, metrics: s.metrics, versusCurrent: s.versusCurrent, details: s.details, sequence: s.sequence, warnings: s.warnings, tradeoffs: s.tradeoffs, overallScore: s.overallScore },
        baseline,
        environment,
      });
      return r ? { ...s, aiExplanation: r.aiExplanation, insights: { whyThisMatters: r.whyThisMatters }, narration: 'llm' as const } : s;
    }),
  );
}
