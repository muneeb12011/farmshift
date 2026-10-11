import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

/** Minimal Prometheus-format registry (no dependency). Labels use the route PATTERN to bound cardinality. */
const BUCKETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];
const esc = (v: string) => v.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');

export class Metrics {
  private requests = new Map<string, number>();
  private hist = new Map<string, { counts: number[]; sum: number; n: number }>();
  private events = new Map<string, number>();

  observeRequest(method: string, route: string, status: number, seconds: number) {
    const k = `${method}|${route}|${status}`;
    this.requests.set(k, (this.requests.get(k) ?? 0) + 1);
    const hk = `${method}|${route}`;
    let h = this.hist.get(hk);
    if (!h) this.hist.set(hk, (h = { counts: new Array(BUCKETS.length).fill(0), sum: 0, n: 0 }));
    BUCKETS.forEach((b, i) => {
      if (seconds <= b) h!.counts[i]!++;
    });
    h.sum += seconds;
    h.n++;
  }

  event(name: string) {
    this.events.set(name, (this.events.get(name) ?? 0) + 1);
  }

  render(extra: { users?: number } = {}): string {
    const out: string[] = [];
    out.push('# HELP http_requests_total HTTP requests by method, route pattern and status', '# TYPE http_requests_total counter');
    for (const [k, v] of this.requests) {
      const [m, r, s] = k.split('|');
      out.push(`http_requests_total{method="${m}",route="${esc(r!)}",status="${s}"} ${v}`);
    }
    out.push('# HELP http_request_duration_seconds Request latency', '# TYPE http_request_duration_seconds histogram');
    for (const [k, h] of this.hist) {
      const [m, r] = k.split('|');
      const lbl = `method="${m}",route="${esc(r!)}"`;
      BUCKETS.forEach((b, i) => out.push(`http_request_duration_seconds_bucket{${lbl},le="${b}"} ${h.counts[i]}`));
      out.push(`http_request_duration_seconds_bucket{${lbl},le="+Inf"} ${h.n}`, `http_request_duration_seconds_sum{${lbl}} ${h.sum.toFixed(6)}`, `http_request_duration_seconds_count{${lbl}} ${h.n}`);
    }
    out.push('# HELP environment_events_total Climate data pipeline events (cache hits, upstream outcomes, fallbacks)', '# TYPE environment_events_total counter');
    for (const [e, v] of this.events) out.push(`environment_events_total{event="${e}"} ${v}`);
    const mem = process.memoryUsage();
    out.push(
      '# TYPE process_uptime_seconds gauge', `process_uptime_seconds ${Math.round(process.uptime())}`,
      '# TYPE process_resident_memory_bytes gauge', `process_resident_memory_bytes ${mem.rss}`,
      '# TYPE nodejs_heap_used_bytes gauge', `nodejs_heap_used_bytes ${mem.heapUsed}`,
    );
    return out.join('\n') + '\n';
  }
}

/** Registers the collection hook and GET /metrics (token-protected; disabled in production without a token). */
export function registerMetrics(app: FastifyInstance, env: Env, metrics: Metrics) {
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions?.url ?? 'unmatched';
    if (route === '/metrics') return;
    metrics.observeRequest(req.method, route, reply.statusCode, reply.elapsedTime / 1000);
  });

  app.get('/metrics', { schema: { hide: true } }, async (req, reply) => {
    if (env.METRICS_TOKEN) {
      if (req.headers.authorization !== `Bearer ${env.METRICS_TOKEN}`) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Metrics token required', requestId: req.id } });
    } else if (env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route GET /metrics not found', requestId: req.id } });
    }
    return reply.type('text/plain; version=0.0.4').send(metrics.render());
  });
}
