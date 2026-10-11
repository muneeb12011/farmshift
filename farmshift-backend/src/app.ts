import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import type { Env } from './config/env.js';
import { ENGINE_VERSION } from './engine/index.js';
import { isAllowedOrigin } from './lib/origins.js';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandling } from './plugins/errors.js';
import { registerMetrics } from './plugins/metrics.js';
import { authRoutes } from './routes/auth.js';
import { cropsRoutes } from './routes/crops.js';
import { environmentRoutes } from './routes/environment.js';
import { farmsRoutes } from './routes/farms.js';
import { healthRoutes, metaRoutes } from './routes/health.js';
import { plansRoutes } from './routes/plans.js';
import { scenariosRoutes } from './routes/scenarios.js';
import { createServices, type ContainerOverrides, type Services } from './services/container.js';

export interface BuiltApp {
  app: FastifyInstance;
  services: Services;
}

export async function buildApp(env: Env, overrides: ContainerOverrides = {}): Promise<BuiltApp> {
  const isProd = env.NODE_ENV === 'production';
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
      ...(env.NODE_ENV === 'development' && env.LOG_LEVEL !== 'silent' ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } } : {}),
    },
    genReqId: (req) => (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].length <= 100 ? req.headers['x-request-id'] : randomUUID()),
    trustProxy: isProd,
    bodyLimit: 1_048_576,
  });

  // Tolerate bodiless requests that still declare JSON (DELETE/POST-without-body from browsers and curl);
  // malformed JSON is still rejected with 400.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (body === '' || body === undefined) return done(null, undefined);
    try {
      done(null, JSON.parse(body as string));
    } catch (e) {
      done(Object.assign(e as Error, { statusCode: 400 }), undefined);
    }
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const services = await createServices(env, { ...overrides, log: overrides.log ?? app.log });
  app.addHook('onClose', async () => {
    await services.sql.close();
  });

  registerErrorHandling(app, isProd);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(env, origin)),
    credentials: true, // browsers send the httpOnly session cookie on cross-origin dev requests
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['x-request-id', 'x-data-provider', 'x-data-quality'],
    maxAge: 600,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: env.RATE_LIMIT_MAX, timeWindow: '1 minute' });

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'FarmShift API',
        version: ENGINE_VERSION,
        description:
          'Satellite-derived environmental data (NASA POWER, MODIS) and an agronomic crop-rotation scenario engine (FAO-56 / FAO-33). Responses are shape-compatible with the FarmShift frontend types.',
      },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      tags: [
        { name: 'environment', description: 'Climate, soil moisture, NDVI, water stress' },
        { name: 'scenarios', description: 'Rotation scenario generation and evaluation' },
        { name: 'runs', description: 'Stored scenario runs and comparison' },
        { name: 'farms', description: 'Fields and their agronomic profile' },
        { name: 'crops', description: 'Crop catalog' },
        { name: 'plans', description: 'Saved rotation plans' },
        { name: 'auth', description: 'Accounts' },
        { name: 'meta', description: 'Methods, sources, engine' },
        { name: 'system', description: 'Probes' },
      ],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await registerAuth(app, env, services.users);

  app.addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  registerMetrics(app, env, services.metrics);

  const typed = app.withTypeProvider<ZodTypeProvider>();
  await typed.register(async (root) => {
    await healthRoutes(root, services);
  });
  await typed.register(
    async (api) => {
      await metaRoutes(api);
      await authRoutes(api, services);
      await cropsRoutes(api);
      await farmsRoutes(api, services);
      await environmentRoutes(api, services);
      await scenariosRoutes(api, services);
      await plansRoutes(api, services);
    },
    { prefix: '/api/v1' },
  );

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  return { app, services };
}
