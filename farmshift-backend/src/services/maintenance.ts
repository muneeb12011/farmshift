import type { Services } from './container.js';

export interface MaintenanceResult {
  anonymousRunsDeleted: number;
  cacheEntriesDeleted: number;
  resetTokensDeleted: number;
}

const DAY = 86_400_000;

/**
 * Housekeeping that keeps the SQLite file bounded:
 *  - anonymous scenario runs older than RUN_RETENTION_DAYS (runs owned by accounts are kept)
 *  - climate cache entries that expired more than 7 days ago
 * Then checkpoints the WAL and lets SQLite refresh its planner statistics.
 */
export async function runMaintenance(svc: Pick<Services, 'env' | 'runs' | 'cache' | 'sql' | 'resets'>): Promise<MaintenanceResult> {
  const anonymousRunsDeleted = await svc.runs.purgeAnonymousOlderThan(svc.env.RUN_RETENTION_DAYS * DAY);
  const cacheEntriesDeleted = await svc.cache.purgeExpiredOlderThan(7 * DAY);
  const resetTokensDeleted = await svc.resets.purgeOlderThan(DAY);
  await svc.sql.housekeeping();
  return { anonymousRunsDeleted, cacheEntriesDeleted, resetTokensDeleted };
}

/** Run once now and then on an interval. The timer never keeps the process alive. */
export function scheduleMaintenance(svc: Services, log: { info: (o: object, m?: string) => void; error: (o: object, m?: string) => void }): () => void {
  const tick = async () => {
    try {
      const r = await runMaintenance(svc);
      if (r.anonymousRunsDeleted || r.cacheEntriesDeleted || r.resetTokensDeleted) log.info(r, 'maintenance complete');
    } catch (err) {
      log.error({ err }, 'maintenance failed');
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), svc.env.MAINTENANCE_INTERVAL_HOURS * 3_600_000);
  timer.unref();
  return () => clearInterval(timer);
}

/** Prefetch climate for the demo farms so their first dashboard load is a cache hit. Failures are ignored. */
export async function warmDemoFarms(svc: Services, log: { info: (o: object, m?: string) => void }): Promise<void> {
  if (!svc.env.WARMUP_DEMO_FARMS || svc.env.ENV_PROVIDER === 'synthetic') return;
  for (const farm of await svc.farms.list()) {
    try {
      await svc.environment.getBundle(farm.lat, farm.lon);
      log.info({ farm: farm.id }, 'climate cache warmed');
    } catch {
      /* upstream unavailable: the request-time fallback chain handles it */
    }
  }
}
