import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { FarmProfileInputSchema, FarmerPrioritiesSchema, FieldLocationSchema, SoilProfileSchema, IRRIGATION_TYPES, WATER_AVAILABILITY } from '../domain/schemas.js';
import { requireUserId, userIdOf } from '../plugins/auth.js';
import type { FarmRecord } from '../repos/farms.js';
import { canonicalCropName } from '../services/analysis.js';
import type { Services } from '../services/container.js';

const FarmOut = FieldLocationSchema.extend({ demo: z.boolean(), createdAt: z.string(), updatedAt: z.string() });
const ProfileOut = z.object({
  field: FieldLocationSchema,
  soil: SoilProfileSchema,
  currentCrop: z.string(),
  waterAvailability: z.enum(WATER_AVAILABILITY),
  irrigationType: z.enum(IRRIGATION_TYPES),
  priorities: FarmerPrioritiesSchema,
  updatedAt: z.string().nullable(),
});

const FarmBody = z.object({
  label: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  area: z.number().positive().max(1_000_000),
});

const toFarmOut = (f: FarmRecord) => ({ id: f.id, lat: f.lat, lon: f.lon, label: f.label, area: f.area, demo: f.ownerId === null, createdAt: f.createdAt, updatedAt: f.updatedAt });

export async function farmsRoutes(app: FastifyInstance, svc: Services) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const Params = z.object({ id: z.string().min(1).max(100) });
  const bearer = [{ bearer: [] }];

  r.get('/farms', { onRequest: [app.optionalAuth], schema: { tags: ['farms'], summary: 'Demo farms plus, when authenticated, your own', response: { 200: z.array(FarmOut) } } }, async (req) =>
    (await svc.farms.list(userIdOf(req))).map(toFarmOut),
  );

  r.get('/farms/:id', { onRequest: [app.optionalAuth], schema: { tags: ['farms'], summary: 'One farm', params: Params, response: { 200: FarmOut } } }, async (req) =>
    toFarmOut(await svc.farms.getReadable(req.params.id, userIdOf(req))),
  );

  r.post(
    '/farms',
    { onRequest: [app.authenticate], schema: { tags: ['farms'], summary: 'Create a farm (optionally with its profile)', security: bearer, body: FarmBody.extend({ profile: FarmProfileInputSchema.optional() }), response: { 201: FarmOut } } },
    async (req, reply) => {
      const { profile, ...farm } = req.body;
      if (profile) profile.currentCrop = canonicalCropName(profile.currentCrop);
      const created = await svc.farms.create(requireUserId(req), farm);
      if (profile) await svc.farms.upsertProfile(created.id, profile);
      return reply.status(201).send(toFarmOut(created));
    },
  );

  r.patch(
    '/farms/:id',
    { onRequest: [app.authenticate], schema: { tags: ['farms'], summary: 'Update a farm you own', security: bearer, params: Params, body: FarmBody.partial().refine((b) => Object.keys(b).length > 0, 'Provide at least one field'), response: { 200: FarmOut } } },
    async (req) => {
      await svc.farms.getWritable(req.params.id, requireUserId(req));
      return toFarmOut(await svc.farms.update(req.params.id, req.body));
    },
  );

  r.delete('/farms/:id', { onRequest: [app.authenticate], schema: { tags: ['farms'], summary: 'Delete a farm you own', security: bearer, params: Params, response: { 204: z.null() } } }, async (req, reply) => {
    await svc.farms.getWritable(req.params.id, requireUserId(req));
    await svc.farms.delete(req.params.id);
    return reply.status(204).send(null);
  });

  r.get('/farms/:id/profile', { onRequest: [app.optionalAuth], schema: { tags: ['farms'], summary: 'Farm profile (soil, crop, water, priorities)', params: Params, response: { 200: ProfileOut } } }, async (req) => {
    const farm = await svc.farms.getReadable(req.params.id, userIdOf(req));
    const p = (await svc.farms.getProfile(farm.id)) ?? { ...FarmProfileInputSchema.parse({}), updatedAt: null as string | null };
    return {
      field: { id: farm.id, lat: farm.lat, lon: farm.lon, label: farm.label, area: farm.area },
      soil: p.soil,
      currentCrop: p.currentCrop,
      waterAvailability: p.waterAvailability,
      irrigationType: p.irrigationType,
      priorities: p.priorities,
      updatedAt: p.updatedAt,
    };
  });

  r.put(
    '/farms/:id/profile',
    { onRequest: [app.authenticate], schema: { tags: ['farms'], summary: 'Replace the profile of a farm you own', security: bearer, params: Params, body: FarmProfileInputSchema, response: { 200: ProfileOut } } },
    async (req) => {
      const farm = await svc.farms.getWritable(req.params.id, requireUserId(req));
      const body = { ...req.body, currentCrop: canonicalCropName(req.body.currentCrop) };
      const p = await svc.farms.upsertProfile(farm.id, body);
      return { field: { id: farm.id, lat: farm.lat, lon: farm.lon, label: farm.label, area: farm.area }, ...p };
    },
  );
}

