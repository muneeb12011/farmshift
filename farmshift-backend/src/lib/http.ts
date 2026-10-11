import { AppError } from './errors.js';

export interface FetchJsonOptions {
  timeoutMs: number;
  /** Total budget across all attempts and backoff sleeps (ms). */
  deadlineMs?: number;
  retries?: number;
  retryBaseMs?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: unknown;
  fetchImpl?: typeof fetch;
  /** Label used in error messages / logs. */
  label: string;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * JSON fetch with per-attempt timeout, bounded retries and exponential backoff + jitter.
 * 4xx responses (other than 408/425/429) are not retried.
 */
export async function fetchJson<T = unknown>(url: string, opts: FetchJsonOptions): Promise<T> {
  const doFetch = opts.fetchImpl ?? fetch;
  const retries = opts.retries ?? 2;
  const base = opts.retryBaseMs ?? 400;
  let lastErr: unknown;
  const deadline = opts.deadlineMs ? Date.now() + opts.deadlineMs : Infinity;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.min(opts.timeoutMs, remaining));
    try {
      const res = await doFetch(url, {
        method: opts.method ?? 'GET',
        headers: {
          accept: 'application/json',
          ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...opts.headers,
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new AppError('UPSTREAM_UNAVAILABLE', 502, `${opts.label} responded ${res.status}`, {
          status: res.status,
          body: text.slice(0, 300),
        });
        if (!RETRYABLE.has(res.status)) throw Object.assign(err, { fatal: true });
        lastErr = err;
      } else {
        return (await res.json()) as T;
      }
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
    const backoff = base * 2 ** attempt + Math.random() * base;
    if (attempt < retries && Date.now() + backoff < deadline) await sleep(backoff);
    else if (attempt < retries) break; // not enough budget left for another attempt
  }

  if (lastErr instanceof AppError) throw lastErr;
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw AppError.upstream(`${opts.label} unreachable: ${reason}`);
}
