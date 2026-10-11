import type { SqlAdapter } from '../db/adapter.js';
import { AppError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

export interface PlanRecord {
  id: string;
  userId: string;
  farmId: string | null;
  name: string;
  crops: string[];
  notes: string | null;
  metrics: Record<string, number> | null;
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
}

const map = (r: Record<string, unknown>): PlanRecord => ({
  id: r.id as string,
  userId: r.user_id as string,
  farmId: (r.farm_id as string | null) ?? null,
  name: r.name as string,
  crops: JSON.parse(r.crops_json as string),
  notes: (r.notes as string | null) ?? null,
  metrics: r.metrics_json ? JSON.parse(r.metrics_json as string) : null,
  overallScore: r.overall === null || r.overall === undefined ? null : Number(r.overall),
  createdAt: new Date(Number(r.created_at)).toISOString(),
  updatedAt: new Date(Number(r.updated_at)).toISOString(),
});

export class PlansRepo {
  constructor(private db: SqlAdapter) {}

  async create(
    userId: string,
    p: { farmId?: string | null; name: string; crops: string[]; notes?: string | null; metrics?: Record<string, number> | null; overallScore?: number | null },
  ): Promise<PlanRecord> {
    const id = newId('plan');
    const now = Date.now();
    await this.db.run(
      'INSERT INTO rotation_plans (id, user_id, farm_id, name, crops_json, notes, metrics_json, overall, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, p.farmId ?? null, p.name.trim(), JSON.stringify(p.crops), p.notes ?? null, p.metrics ? JSON.stringify(p.metrics) : null, p.overallScore ?? null, now, now],
    );
    return this.getOwned(id, userId);
  }

  async getOwned(id: string, userId: string): Promise<PlanRecord> {
    const r = await this.db.get('SELECT * FROM rotation_plans WHERE id = ? AND user_id = ?', [id, userId]);
    if (!r) throw AppError.notFound('Plan');
    return map(r);
  }

  async list(userId: string, opts: { farmId?: string; limit: number; offset: number }): Promise<{ items: PlanRecord[]; total: number }> {
    const where = opts.farmId ? 'user_id = ? AND farm_id = ?' : 'user_id = ?';
    const args = opts.farmId ? [userId, opts.farmId] : [userId];
    const rows = await this.db.all(`SELECT * FROM rotation_plans WHERE ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`, [...args, opts.limit, opts.offset]);
    const total = Number((await this.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM rotation_plans WHERE ${where}`, args))!.n);
    return { items: rows.map(map), total };
  }

  async update(
    id: string,
    userId: string,
    patch: { name?: string; crops?: string[]; notes?: string | null; farmId?: string | null; metrics?: Record<string, number> | null; overallScore?: number | null },
  ): Promise<PlanRecord> {
    const cur = await this.getOwned(id, userId);
    await this.db.run('UPDATE rotation_plans SET name = ?, crops_json = ?, notes = ?, farm_id = ?, metrics_json = ?, overall = ?, updated_at = ? WHERE id = ? AND user_id = ?', [
      patch.name?.trim() ?? cur.name,
      JSON.stringify(patch.crops ?? cur.crops),
      patch.notes === undefined ? cur.notes : patch.notes,
      patch.farmId === undefined ? cur.farmId : patch.farmId,
      JSON.stringify(patch.metrics === undefined ? cur.metrics : patch.metrics),
      patch.overallScore === undefined ? cur.overallScore : patch.overallScore,
      Date.now(),
      id,
      userId,
    ]);
    return this.getOwned(id, userId);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    return (await this.db.run('DELETE FROM rotation_plans WHERE id = ? AND user_id = ?', [id, userId])).changes > 0;
  }
}
