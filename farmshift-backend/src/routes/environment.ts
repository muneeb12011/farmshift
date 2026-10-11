import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { summarise } from '../engine/summary.js';
import { resample, tail, toSeriesPoints, type ClimateBundle, type Resolution } from '../engine/climate.js';
import { DATE_RANGES, EnvironmentDataPointSchema, EnvironmentMetaSchema, EnvironmentSummarySchema, LatSchema, LonSchema } from '../domain/schemas.js';
import { userIdOf } from '../plugins/auth.js';
import { loadEnvironment, RANGE_DAYS } from '../services/analysis.js';
import type { Services } from '../services/container.js';

const LocationQuery = z.object({ lat: LatSchema, lon: LonSchema });
const SeriesQuery = z.object({
  range: z.enum(DATE_RANGES).default('1y'),
  resolution: z.enum(['auto', 'daily', 'weekly', 'monthly']).default('auto'),
  envelope: z.stringbool().default(false),
});
const SeriesOut = z.union([z.array(EnvironmentDataPointSchema), z.object({ points: z.array(EnvironmentDataPointSchema), resolution: z.string(), meta: EnvironmentMetaSchema })]);

function provenanceHeaders(reply: FastifyReply, b: ClimateBundle) {
  reply.header('x-data-provider', b.provenance.climate.provider);
  reply.header('x-data-quality', `climate=${b.provenance.climate.stale ? 'stale' : 'fresh'};vegetation=${b.provenance.vegetation.quality}`);
  reply.header('cache-control', 'public, max-age=300');
}

/** `auto` keeps payloads chart-friendly: daily up to 1 year, weekly beyond. */
function pickResolution(range: string, requested: string): Resolution {
  if (requested !== 'auto') return requested as Resolution;
  return range === '5y' ? 'weekly' : 'daily';
}

export async function environmentRoutes(app: FastifyInstance, svc: Services) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  const series = (bundle: ClimateBundle, q: z.infer<typeof SeriesQuery>, reply: FastifyReply) => {
    const days = RANGE_DAYS[q.range]!;
    const sliced: ClimateBundle = { ...bundle, daily: tail(bundle.daily, days + 1), ndvi: tail(bundle.ndvi, days + 1) };
    const resolution = pickResolution(q.range, q.resolution);
    const points = resample(toSeriesPoints(sliced), resolution);
    provenanceHeaders(reply, bundle);
    if (!q.envelope) return points;
    return { points, resolution, meta: summarise(bundle).meta! };
  };

  r.get(
    '/environment/summary',
    { schema: { tags: ['environment'], summary: 'Environmental summary for a coordinate (temperature, rainfall, soil moisture, NDVI, water stress)', querystring: LocationQuery, response: { 200: EnvironmentSummarySchema } } },
    async (req, reply) => {
      const { bundle, summary } = await loadEnvironment(svc, req.query.lat, req.query.lon);
      provenanceHeaders(reply, bundle);
      return summary;
    },
  );

  r.get(
    '/environment/timeseries',
    {
      schema: {
        tags: ['environment'],
        summary: 'Daily (or weekly/monthly) series for a coordinate. Array by default; envelope=true adds provenance metadata.',
        querystring: LocationQuery.extend(SeriesQuery.shape),
        response: { 200: SeriesOut },
      },
    },
    async (req, reply) => {
      const { bundle } = await loadEnvironment(svc, req.query.lat, req.query.lon);
      return series(bundle, req.query, reply);
    },
  );

  const FarmParams = z.object({ id: z.string().min(1).max(100) });

  r.get(
    '/farms/:id/environment/summary',
    { onRequest: [app.optionalAuth], schema: { tags: ['environment'], summary: 'Environmental summary for a farm', params: FarmParams, response: { 200: EnvironmentSummarySchema } } },
    async (req, reply) => {
      const farm = await svc.farms.getReadable(req.params.id, userIdOf(req));
      const { bundle, summary } = await loadEnvironment(svc, farm.lat, farm.lon);
      provenanceHeaders(reply, bundle);
      return summary;
    },
  );

  r.get(
    '/farms/:id/environment/timeseries',
    { onRequest: [app.optionalAuth], schema: { tags: ['environment'], summary: 'Environmental time series for a farm', params: FarmParams, querystring: SeriesQuery, response: { 200: SeriesOut } } },
    async (req, reply) => {
      const farm = await svc.farms.getReadable(req.params.id, userIdOf(req));
      const { bundle } = await loadEnvironment(svc, farm.lat, farm.lon);
      return series(bundle, req.query, reply);
    },
  );
}
