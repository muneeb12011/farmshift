import type { SqlAdapter } from '../db/adapter.js';
import { AppError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

export interface RunRecord<I = unknown, R = unknown> {
  id: string;
  userId: string | null;
  farmId: string | null;
  engineVersion: string;
  input: I;
  result: R;
  createdAt: string;
}

const map = (r: Record<string, unknown>): RunRecord => ({
  id: r.id as string,
  userId: (r.user_id as string | null) ?? null,
  farmId: (r.farm_id as string | null) ?? null,
  engineVersion: r.engine_version as string,
  input: JSON.parse(r.input_json as string),
  result: JSON.parse(r.result_json as string),
  createdAt: new Date(Number(r.created_at)).toISOString(),
});

export class RunsRepo {
  constructor(private db: SqlAdapter) {}

  async create(args: { userId?: string; farmId?: string; engineVersion: string; input: unknown; result: unknown }): Promise<string> {
    const id = newId('run');
    await this.db.run('INSERT INTO scenario_runs (id, user_id, farm_id, engine_version, input_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      id,
      args.userId ?? null,
      args.farmId ?? null,
      args.engineVersion,
      JSON.stringify(args.input),
      JSON.stringify(args.result),
      Date.now(),
    ]);
    return id;
  }

  /** Anonymous runs are capability-addressed (anyone holding the id); owned runs are owner-only. */
  async getAccessible(id: string, userId?: string): Promise<RunRecord> {
    const r = await this.db.get('SELECT * FROM scenario_runs WHERE id = ?', [id]);
    if (!r) throw AppError.notFound('Run');
    const run = map(r);
    if (run.userId !== null && run.userId !== userId) throw AppError.notFound('Run');
    return run;
  }

  async listForUser(userId: string, limit: number, offset: number): Promise<{ items: Omit<RunRecord, 'result' | 'input'>[]; total: number }> {
    const rows = await this.db.all('SELECT id, user_id, farm_id, engine_version, created_at FROM scenario_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [userId, limit, offset]);
    const total = Number((await this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM scenario_runs WHERE user_id = ?', [userId]))!.n);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id as string,
        userId: r.user_id as string,
        farmId: (r.farm_id as string | null) ?? null,
        engineVersion: r.engine_version as string,
        createdAt: new Date(Number(r.created_at)).toISOString(),
      })),
    };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return (await this.db.run('DELETE FROM scenario_runs WHERE id = ? AND user_id = ?', [id, userId])).changes > 0;
  }

  /** Delete anonymous runs (no owner) older than `maxAgeMs`. Owned runs are never touched. */
  async purgeAnonymousOlderThan(maxAgeMs: number): Promise<number> {
    return (await this.db.run('DELETE FROM scenario_runs WHERE user_id IS NULL AND created_at < ?', [Date.now() - maxAgeMs])).changes;
  }
}
