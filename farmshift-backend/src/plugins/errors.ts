import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { AppError, type ErrorCode } from '../lib/errors.js';

export interface ErrorEnvelope {
  error: { code: ErrorCode; message: string; details?: unknown; requestId: string };
}

export function registerErrorHandling(app: FastifyInstance, isProd: boolean) {
  app.setNotFoundHandler((req, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url.split('?')[0]} not found`, requestId: req.id } } satisfies ErrorEnvelope);
  });

  app.setErrorHandler((err: FastifyError | AppError | Error, req, reply) => {
    const send = (status: number, code: ErrorCode, message: string, details?: unknown) =>
      reply.status(status).send({ error: { code, message, ...(details !== undefined ? { details } : {}), requestId: req.id } } satisfies ErrorEnvelope);

    if (hasZodFastifySchemaValidationErrors(err)) {
      const issues = err.validation.map((v) => ({
        path: (v.instancePath || '').replace(/^\//, '').replaceAll('/', '.') || (v.params as { issue?: { path?: string[] } } | undefined)?.issue?.path?.join('.') || '(root)',
        message: v.message ?? 'Invalid value',
      }));
      return send(400, 'VALIDATION_ERROR', 'Request validation failed', issues);
    }
    if (isResponseSerializationError(err)) {
      req.log.error({ err }, 'response failed schema validation');
      return send(500, 'INTERNAL', 'Internal server error');
    }
    if (err instanceof AppError) {
      if (err.statusCode >= 500) req.log.error({ err }, err.message);
      return send(err.statusCode, err.code, err.message, err.details);
    }
    const status = (err as FastifyError).statusCode ?? 500;
    if (status === 429) return send(429, 'RATE_LIMITED', 'Too many requests; slow down and retry shortly');
    if (status >= 400 && status < 500) return send(status, status === 401 ? 'UNAUTHORIZED' : 'VALIDATION_ERROR', err.message);
    req.log.error({ err }, 'unhandled error');
    return send(500, 'INTERNAL', isProd ? 'Internal server error' : err.message);
  });
}
