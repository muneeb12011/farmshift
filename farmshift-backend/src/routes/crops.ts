import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CROPS, resolveCrop, toCropInfo } from '../domain/crops.js';
import { CropInfoSchema } from '../domain/schemas.js';
import { AppError } from '../lib/errors.js';

const Detail = z.object({ detail: z.enum(['basic', 'full']).default('basic') });
const Out = CropInfoSchema.loose();

export async function cropsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/crops', { schema: { tags: ['crops'], summary: 'Crop catalog (detail=full adds agronomic parameters)', querystring: Detail, response: { 200: z.array(Out) } } }, async (req, reply) => {
    reply.header('cache-control', 'public, max-age=3600');
    return req.query.detail === 'full' ? CROPS.map((c) => ({ ...c })) : CROPS.map(toCropInfo);
  });

  r.get(
    '/crops/:idOrName',
    { schema: { tags: ['crops'], summary: 'One crop by id ("cover_crop") or name ("Cover Crop")', params: z.object({ idOrName: z.string().min(1) }), querystring: Detail, response: { 200: Out } } },
    async (req, reply) => {
      const crop = resolveCrop(decodeURIComponent(req.params.idOrName));
      if (!crop) throw AppError.notFound('Crop');
      reply.header('cache-control', 'public, max-age=3600');
      return req.query.detail === 'full' ? { ...crop } : toCropInfo(crop);
    },
  );
}
