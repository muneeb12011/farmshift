import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CROP_IDS, resolveCrop } from '../domain/crops.js';
import {
  BaselineSchema,
  EnvironmentSummarySchema,
  LocationSchema,
  PaginationQuery,
  ProfileOverrideSchema,
  ScenarioMetricsSchema,
  ScenarioOutSchema,
  type ScenarioMetrics,
} from '../domain/schemas.js';
import { ENGINE_VERSION, evaluateCustom, generateScenarios, type BaselineOut, type ScenarioOut } from '../engine/index.js';
import { AppError } from '../lib/errors.js';
import { requireUserId, userIdOf } from '../plugins/auth.js';
import { loadEnvironment, resolveTarget, toResolvedProfile } from '../services/analysis.js';
import type { Services } from '../services/container.js';
import { applyNarration } from '../services/narrator.js';

const Target = z.object({
  farmId: z.string().min(1).max(100).optional(),
  location: LocationSchema.optional(),
  profile: ProfileOverrideSchema.optional(),
});

const GenerateBody = Target.extend({
  options: z
    .object({
      length: z.number().int().min(2).max(5).default(3),
      count: z.number().int().min(1).max(5).default(3),
      anchorCurrentCrop: z.boolean().default(true),
      excludeCrops: z.array(z.string()).max(8).default([]),
      mustInclude: z.array(z.string()).max(4).default([]),
    })
    .default({ length: 3, count: 3, anchorCurrentCrop: true, excludeCrops: [], mustInclude: [] }),
  narration: z.enum(['template', 'llm']).default('template'),
});

const EvaluateBody = Target.extend({ rotation: z.array(z.string().min(1)).min(1).max(8) });

const ContextOut = z.object({ annualPrecipMm: z.number(), annualEt0Mm: z.number(), aridityIndex: z.number(), candidatesEvaluated: z.number(), viableCrops: z.number() });

const RunOut = z.object({
  runId: z.string(),
  createdAt: z.string(),
  engineVersion: z.string(),
  location: z.object({ lat: z.number(), lon: z.number(), farmId: z.string().nullable() }),
  baseline: BaselineSchema,
  scenarios: z.array(ScenarioOutSchema),
  environment: EnvironmentSummarySchema,
  context: ContextOut,
  warnings: z.array(z.string()),
});
type RunPayload = z.infer<typeof RunOut>;

const METRICS: (keyof ScenarioMetrics)[] = ['waterDemand', 'soilHealth', 'climateCompatibility', 'cropDiversity', 'nutrientPressure', 'environmentalResilience'];
/** Lower is better for these. */
const LOWER_BETTER = new Set<keyof ScenarioMetrics>(['waterDemand', 'nutrientPressure']);

function resolveRotation(rotation: string[]): string[] {
  return rotation.map((c) => {
    const crop = resolveCrop(c);
    if (!crop) throw AppError.unprocessable(`Unknown crop "${c}"`, { validCrops: CROP_IDS });
    return crop.id;
  });
}

export async function scenariosRoutes(app: FastifyInstance, svc: Services) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const bearer = [{ bearer: [] }];
  const heavy = { rateLimit: { max: 30, timeWindow: '1 minute' } };

  r.post(
    '/scenarios/generate',
    {
      onRequest: [app.optionalAuth],
      config: heavy,
      schema: {
        tags: ['scenarios'],
        summary: 'Generate crop-rotation scenarios for a farm or coordinate',
        description:
          'Pulls (cached) satellite-derived climate for the location, evaluates every admissible rotation with the agronomy engine and returns distinct scenarios (A–E archetypes) with metrics, trade-offs and a grounded explanation. The result is stored as a run and can be reopened via /runs/{runId}.',
        body: GenerateBody,
        response: { 200: RunOut },
      },
    },
    async (req) => {
      const userId = userIdOf(req);
      const target = await resolveTarget(svc, userId, req.body);
      const profile = toResolvedProfile(target.profile);
      const { bundle, summary } = await loadEnvironment(svc, target.lat, target.lon);

      const opts = req.body.options;
      for (const c of [...opts.excludeCrops, ...opts.mustInclude]) resolveRotation([c]);
      const result = generateScenarios({ profile, bundle, summary }, opts);
      if (result.scenarios.length === 0) {
        throw AppError.unprocessable('No admissible rotations for these constraints on this field', { warnings: result.warnings });
      }

      let scenarios: ScenarioOut[] = result.scenarios;
      const warnings = [...result.warnings];
      if (req.body.narration === 'llm') {
        if (!svc.narrator.enabled) warnings.push('LLM narration requested but ANTHROPIC_API_KEY is not configured; using deterministic text.');
        else {
          scenarios = await applyNarration(svc.narrator, scenarios, result.baseline, summary);
          if (scenarios.some((s) => s.narration === 'template')) warnings.push('Some explanations failed validation and use deterministic text instead.');
        }
      }

      const payload: Omit<RunPayload, 'runId' | 'createdAt'> = {
        engineVersion: ENGINE_VERSION,
        location: { lat: target.lat, lon: target.lon, farmId: target.farmId ?? null },
        baseline: result.baseline,
        scenarios,
        environment: summary,
        context: result.context,
        warnings,
      };
      const runId = await svc.runs.create({ userId, farmId: target.farmId, engineVersion: ENGINE_VERSION, input: { ...req.body, resolvedProfile: target.profile }, result: payload });
      return { runId, createdAt: new Date().toISOString(), ...payload };
    },
  );

  r.post(
    '/scenarios/evaluate',
    {
      onRequest: [app.optionalAuth],
      config: heavy,
      schema: {
        tags: ['scenarios'],
        summary: 'Score a user-built rotation (rotation builder) with the same engine',
        body: EvaluateBody,
        response: { 200: z.object({ baseline: BaselineSchema, scenario: ScenarioOutSchema, environment: EnvironmentSummarySchema, warnings: z.array(z.string()) }) },
      },
    },
    async (req) => {
      const target = await resolveTarget(svc, userIdOf(req), req.body);
      const profile = toResolvedProfile(target.profile);
      const cropIds = resolveRotation(req.body.rotation);
      const { bundle, summary } = await loadEnvironment(svc, target.lat, target.lon);
      const out = evaluateCustom({ profile, bundle, summary }, cropIds);
      return { baseline: out.baseline, scenario: out.scenario, environment: summary, warnings: out.warnings };
    },
  );

  // ---- runs ----
  const RunParams = z.object({ runId: z.string().min(1).max(100) });

  r.get(
    '/runs',
    { onRequest: [app.authenticate], schema: { tags: ['runs'], summary: 'Your scenario runs, newest first', security: bearer, querystring: PaginationQuery, response: { 200: z.object({ items: z.array(z.object({ id: z.string(), farmId: z.string().nullable(), engineVersion: z.string(), createdAt: z.string() })), total: z.number(), limit: z.number(), offset: z.number() }) } } },
    async (req) => {
      const { items, total } = await svc.runs.listForUser(requireUserId(req), req.query.limit, req.query.offset);
      return { items: items.map(({ id, farmId, engineVersion, createdAt }) => ({ id, farmId, engineVersion, createdAt })), total, limit: req.query.limit, offset: req.query.offset };
    },
  );

  const loadRun = async (runId: string, userId?: string) => {
    const run = await svc.runs.getAccessible(runId, userId);
    return { run, result: run.result as Omit<RunPayload, 'runId' | 'createdAt'> };
  };

  r.get('/runs/:runId', { onRequest: [app.optionalAuth], schema: { tags: ['runs'], summary: 'Reopen a run (anonymous runs are addressed by their unguessable id)', params: RunParams, response: { 200: RunOut } } }, async (req) => {
    const { run, result } = await loadRun(req.params.runId, userIdOf(req));
    return { runId: run.id, createdAt: run.createdAt, ...result };
  });

  r.get(
    '/runs/:runId/scenarios/:scenarioId',
    { onRequest: [app.optionalAuth], schema: { tags: ['runs'], summary: 'One scenario from a run', params: RunParams.extend({ scenarioId: z.string().min(1).max(60) }), response: { 200: ScenarioOutSchema } } },
    async (req) => {
      const { result } = await loadRun(req.params.runId, userIdOf(req));
      const s = result.scenarios.find((x) => x.id === req.params.scenarioId);
      if (!s) throw AppError.notFound('Scenario');
      return s;
    },
  );

  r.delete('/runs/:runId', { onRequest: [app.authenticate], schema: { tags: ['runs'], summary: 'Delete one of your runs', security: bearer, params: RunParams, response: { 204: z.null() } } }, async (req, reply) => {
    if (!(await svc.runs.delete(req.params.runId, requireUserId(req)))) throw AppError.notFound('Run');
    return reply.status(204).send(null);
  });

  r.post(
    '/runs/:runId/compare',
    {
      onRequest: [app.optionalAuth],
      schema: {
        tags: ['runs'],
        summary: 'Side-by-side comparison of scenarios in a run, with deltas versus the current plan and a winner per metric',
        params: RunParams,
        body: z.object({ scenarioIds: z.array(z.string()).min(2).max(5) }),
        response: {
          200: z.object({
            baseline: BaselineSchema,
            scenarios: z.array(z.object({ id: z.string(), name: z.string(), overallScore: z.number(), metrics: ScenarioMetricsSchema, versusCurrent: ScenarioMetricsSchema.extend({ overallScore: z.number() }) })),
            winners: z.record(z.string(), z.string()),
          }),
        },
      },
    },
    async (req) => {
      const { result } = await loadRun(req.params.runId, userIdOf(req));
      const ids = [...new Set(req.body.scenarioIds)];
      const chosen = ids.map((id) => {
        const s = result.scenarios.find((x) => x.id === id);
        if (!s) throw AppError.notFound(`Scenario ${id}`);
        return s;
      });
      const winners: Record<string, string> = {};
      for (const m of METRICS) {
        const best = [...chosen].sort((a, b) => (LOWER_BETTER.has(m) ? a.metrics[m] - b.metrics[m] : b.metrics[m] - a.metrics[m]))[0]!;
        winners[m] = best.id;
      }
      winners.overallScore = [...chosen].sort((a, b) => b.overallScore - a.overallScore)[0]!.id;
      return {
        baseline: result.baseline as BaselineOut,
        scenarios: chosen.map((s) => ({ id: s.id, name: s.name, overallScore: s.overallScore, metrics: s.metrics, versusCurrent: s.versusCurrent })),
        winners,
      };
    },
  );
}
