import { describe, expect, it } from 'vitest';
import { AnthropicNarrator, NullNarrator, applyNarration, extractNumbers, isGrounded, type NarrationFacts } from '../src/services/narrator.js';
import { DEFAULT_PRIORITIES, DEFAULT_SOIL } from '../src/domain/schemas.js';
import { generateScenarios } from '../src/engine/index.js';
import { summarise } from '../src/engine/summary.js';
import { generateSyntheticClimate } from '../src/providers/synthetic.js';
import { estimateNdvi } from '../src/providers/ndvi-model.js';

const facts = { overallScore: 74, metrics: { waterDemand: 38, soilHealth: 66.4 }, details: { meanNetNitrogenKgHa: 47 }, ratio: 0.62 };

describe('numeric grounding guard', () => {
  it('extracts numbers', () => expect(extractNumbers('about 38 mm and -2.5 °C, 0.62')).toEqual([38, -2.5, 0.62]));
  it('accepts numbers derivable from the facts (exact, rounded, percentage form)', () => {
    expect(isGrounded('Score 74, soil health 66, N need 47 kg, supply 62% of demand.', facts)).toBe(true);
    expect(isGrounded('Soil health is 66.4.', facts)).toBe(true);
  });
  it('rejects invented figures', () => {
    expect(isGrounded('This saves 55% of water.', facts)).toBe(false);
    expect(isGrounded('Expect a 23% yield gain.', facts)).toBe(false);
  });
  it('allows small structural counts (3-crop cycle)', () => expect(isGrounded('A 3-crop cycle with 4 benefits.', facts)).toBe(true));
});

describe('AnthropicNarrator', () => {
  const env = { ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_MODEL: 'claude-sonnet-5-5', ANTHROPIC_BASE: 'https://api.anthropic.com' };
  const reply = (obj: unknown, status = 200) => (async () => new Response(JSON.stringify(obj), { status })) as typeof fetch;
  const text = (t: string) => reply({ content: [{ type: 'text', text: t }] });
  const f = facts as unknown as NarrationFacts;
  const good = JSON.stringify({ aiExplanation: 'Overall score is 74 with 47 kg of nitrogen needed.', whyThisMatters: ['Water demand index is 38.', 'Soil health is 66.', 'Fertiliser need is low.', 'Rotation breaks pest cycles.'] });

  it('accepts a valid, grounded response (also inside a code fence)', async () => {
    expect(await new AnthropicNarrator(env, text(good)).narrate(f)).toMatchObject({ aiExplanation: expect.stringContaining('74') });
    expect(await new AnthropicNarrator(env, text('```json\n' + good + '\n```')).narrate(f)).not.toBeNull();
  });
  it('sends the key, version header and the facts', async () => {
    let seen: { headers: Record<string, string>; body: { model: string; messages: { content: string }[] } } | undefined;
    const spy = (async (_u: string, init: RequestInit) => {
      seen = { headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) };
      return new Response(JSON.stringify({ content: [{ type: 'text', text: good }] }));
    }) as unknown as typeof fetch;
    await new AnthropicNarrator(env, spy).narrate(f);
    expect(seen!.headers['x-api-key']).toBe('sk-test');
    expect(seen!.headers['anthropic-version']).toBe('2023-06-01');
    expect(seen!.body.model).toBe('claude-sonnet-5-5');
    expect(JSON.parse(seen!.body.messages[0]!.content)).toEqual(facts);
  });
  it('rejects ungrounded numbers, wrong shapes, bad JSON and upstream errors', async () => {
    const bad = JSON.stringify({ aiExplanation: 'You will gain 31% more yield.', whyThisMatters: ['a', 'b', 'c', 'd'] });
    expect(await new AnthropicNarrator(env, text(bad)).narrate(f)).toBeNull();
    expect(await new AnthropicNarrator(env, text(JSON.stringify({ aiExplanation: 'ok 74', whyThisMatters: ['only one'] }))).narrate(f)).toBeNull();
    expect(await new AnthropicNarrator(env, text('not json')).narrate(f)).toBeNull();
    expect(await new AnthropicNarrator(env, reply({ error: 'x' }, 500)).narrate(f)).toBeNull();
  });
});

describe('applyNarration', () => {
  const { daily, elevationM } = generateSyntheticClimate({ lat: 30, lon: 71, start: '2022-01-01', end: '2025-12-31' });
  const bundle = { lat: 30, lon: 71, elevationM, daily, ndvi: estimateNdvi(daily), provenance: { climate: { provider: 'synthetic' as const, stale: false, fetchedAt: '' }, vegetation: { provider: 'phenology-model' as const, quality: 'estimated' as const }, warnings: [] } };
  const res = generateScenarios({ profile: { soil: DEFAULT_SOIL, currentCropId: 'wheat', waterAvailability: 'Moderate', irrigationType: 'Mixed', priorities: DEFAULT_PRIORITIES }, bundle, summary: summarise(bundle) });

  it('is a no-op with the null narrator', async () => {
    const out = await applyNarration(new NullNarrator(), res.scenarios, res.baseline);
    expect(out).toBe(res.scenarios);
  });
  it('replaces text only for scenarios the narrator returns, keeps numbers untouched', async () => {
    let n = 0;
    const narrator = { enabled: true, narrate: async () => (n++ === 0 ? { aiExplanation: 'Rewritten.', whyThisMatters: ['1', '2', '3', '4'] } : null) };
    const out = await applyNarration(narrator, res.scenarios, res.baseline);
    expect(out[0]!.narration).toBe('llm');
    expect(out[0]!.aiExplanation).toBe('Rewritten.');
    expect(out[1]!.narration).toBe('template');
    expect(out.map((s) => s.metrics)).toEqual(res.scenarios.map((s) => s.metrics));
  });
});
