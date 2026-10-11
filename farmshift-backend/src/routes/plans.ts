import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CROP_IDS, resolveCrop } from '../domain/crops.js';
import { PaginationQuery, ScenarioMetricsSchema } from '../domain/schemas.js';
import { evaluateCustom } from '../engine/index.js';
import { AppError } from '../lib/errors.js';
import { requireUserId } from '../plugins/auth.js';
import type { PlanRecord } from '../repos/plans.js';
import { loadEnvironment, resolveTarget, toResolvedProfile } from '../services/analysis.js';
import type { Services } from '../services/container.js';

const PlanOut = z.object({
  id: z.string(),
  farmId: z.string().nullable(),
  name: z.string(),
  crops: z.array(z.string()),
  notes: z.string().nullable(),
  metrics: ScenarioMetricsSchema.nullable(),
  overallScore: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CropsField = z.array(z.string().min(1)).min(1).max(8);

function canonicalCrops(crops: string[]): string[] {
  return crops.map((c) => {
    const crop = resolveCrop(c);
    if (!crop) throw AppError.unprocessable(`Unknown crop "${c}"`, { validCrops: CROP_IDS });
    return crop.name;
  });
}

const toOut = (p: PlanRecord) => ({
  id: p.id,
  farmId: p.farmId,
  name: p.name,
  crops: p.crops,
  notes: p.notes,
  metrics: (p.metrics as z.infer<typeof ScenarioMetricsSchema> | null) ?? null,
  overallScore: p.overallScore,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

export async function plansRoutes(app: FastifyInstance, svc: Services) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const auth = { onRequest: [app.authenticate] };
  const bearer = [{ bearer: [] }];
  const Params = z.object({ id: z.string().min(1).max(100) });

  /** Snapshot metrics for a plan against its farm; null when no farm is attached. */
  async function snapshot(userId: string, farmId: string | null | undefined, crops: string[]) {
    if (!farmId) return { metrics: null, overallScore: null };
    const target = await resolveTarget(svc, userId, { farmId });
    const { bundle, summary } = await loadEnvironment(svc, target.lat, target.lon);
    const out = evaluateCustom({ profile: toResolvedProfile(target.profile), bundle, summary }, crops.map((c) => resolveCrop(c)!.id));
    return { metrics: out.scenario.metrics as Record<string, number>, overallScore: out.scenario.overallScore };
  }

  r.post(
    '/plans',
    {
      ...auth,
      schema: {
        tags: ['plans'],
        summary: 'Save a rotation plan. With a farmId, the engine scores it and stores the metric snapshot.',
        security: bearer,
        body: z.object({
          name: z.string().trim().min(1).max(120),
          crops: CropsField,
          farmId: z.string().min(1).max(100).optional(),
          notes: z.string().max(2000).optional(),
          /** Metrics as shown to the user when saving (used only when no farmId is given; with a farmId the engine re-scores). */
          metrics: ScenarioMetricsSchema.optional(),
          overallScore: z.number().min(0).max(100).optional(),
        }),
        response: { 201: PlanOut },
      },
    },
    async (req, reply) => {
      const userId = requireUserId(req);
      const crops = canonicalCrops(req.body.crops);
      if (req.body.farmId) await svc.farms.getReadable(req.body.farmId, userId);
      const snap = req.body.farmId
        ? await snapshot(userId, req.body.farmId, crops)
        : { metrics: (req.body.metrics as Record<string, number> | undefined) ?? null, overallScore: req.body.overallScore ?? null };
      const plan = await svc.plans.create(userId, { farmId: req.body.farmId, name: req.body.name, crops, notes: req.body.notes, ...snap });
      return reply.status(201).send(toOut(plan));
    },
  );

  r.get(
    '/plans',
    { ...auth, schema: { tags: ['plans'], summary: 'Your saved plans', security: bearer, querystring: PaginationQuery.extend({ farmId: z.string().optional() }), response: { 200: z.object({ items: z.array(PlanOut), total: z.number(), limit: z.number(), offset: z.number() }) } } },
    async (req) => {
      const { items, total } = await svc.plans.list(requireUserId(req), { farmId: req.query.farmId, limit: req.query.limit, offset: req.query.offset });
      return { items: items.map(toOut), total, limit: req.query.limit, offset: req.query.offset };
    },
  );

  r.get('/plans/:id', { ...auth, schema: { tags: ['plans'], summary: 'One saved plan', security: bearer, params: Params, response: { 200: PlanOut } } }, async (req) => toOut(await svc.plans.getOwned(req.params.id, requireUserId(req))));

  r.patch(
    '/plans/:id',
    {
      ...auth,
      schema: {
        tags: ['plans'],
        summary: 'Edit a plan; changing crops or farm re-scores it',
        security: bearer,
        params: Params,
        body: z.object({ name: z.string().trim().min(1).max(120).optional(), crops: CropsField.optional(), farmId: z.string().min(1).max(100).nullable().optional(), notes: z.string().max(2000).nullable().optional() }).refine((b) => Object.keys(b).length > 0, 'Provide at least one field'),
        response: { 200: PlanOut },
      },
    },
    async (req) => {
      const userId = requireUserId(req);
      const cur = await svc.plans.getOwned(req.params.id, userId);
      const crops = req.body.crops ? canonicalCrops(req.body.crops) : undefined;
      const farmId = req.body.farmId === undefined ? cur.farmId : req.body.farmId;
      if (farmId) await svc.farms.getReadable(farmId, userId);
      const rescore = crops !== undefined || req.body.farmId !== undefined;
      const snap = rescore ? await snapshot(userId, farmId, crops ?? cur.crops) : {};
      return toOut(await svc.plans.update(req.params.id, userId, { name: req.body.name, crops, notes: req.body.notes, farmId: req.body.farmId, ...snap }));
    },
  );

  r.delete('/plans/:id', { ...auth, schema: { tags: ['plans'], summary: 'Delete a plan', security: bearer, params: Params, response: { 204: z.null() } } }, async (req, reply) => {
    if (!(await svc.plans.delete(req.params.id, requireUserId(req)))) throw AppError.notFound('Plan');
    return reply.status(204).send(null);
  });
}
