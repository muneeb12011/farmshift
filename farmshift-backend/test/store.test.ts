import { describe, expect, it } from 'vitest';
import { UniqueViolation, type SqlAdapter } from '../src/db/adapter.js';
import { PgAdapter, toPgPlaceholders } from '../src/db/pg-adapter.js';
import { SqliteAdapter } from '../src/db/sqlite-adapter.js';
import { CacheRepo } from '../src/repos/cache.js';
import { FarmsRepo } from '../src/repos/farms.js';
import { PlansRepo } from '../src/repos/plans.js';
import { RunsRepo } from '../src/repos/runs.js';
import { UsersRepo } from '../src/repos/users.js';
import { PG_URL } from './helpers.js';

let n = 0;
const pgSchema = () => `c_${process.pid}_${Date.now().toString(36)}_${n++}`;
const pg = () => PgAdapter.connect({ url: PG_URL!, max: 3, ssl: false, schema: pgSchema() });

const adapters: { name: string; make: () => Promise<SqlAdapter> }[] = [
  { name: 'sqlite', make: async () => SqliteAdapter.open(':memory:') },
  ...(PG_URL ? [{ name: 'postgres', make: pg as () => Promise<SqlAdapter> }] : []),
];

describe('placeholder translation', () => {
  it('converts ? to $n but leaves ? inside string literals alone', () => {
    expect(toPgPlaceholders('SELECT * FROM t WHERE a = ? AND b = ?')).toBe('SELECT * FROM t WHERE a = $1 AND b = $2');
    expect(toPgPlaceholders("SELECT '?' AS q, x FROM t WHERE y = ?")).toBe("SELECT '?' AS q, x FROM t WHERE y = $1");
  });
});

describe.each(adapters)('repositories on $name (identical behaviour required)', ({ make }) => {
  const setup = async () => {
    const sql = await make();
    await sql.migrate();
    return { sql, users: new UsersRepo(sql), farms: new FarmsRepo(sql), runs: new RunsRepo(sql), plans: new PlansRepo(sql), cache: new CacheRepo(sql), done: async () => {
      await (sql as unknown as { dropSchema?: () => Promise<void> }).dropSchema?.();
      await sql.close();
    } };
  };

  it('migrations are idempotent', async () => {
    const s = await setup();
    expect(await s.sql.migrate()).toEqual([]);
    await s.done();
  });

  it('users: case-insensitive unique email, lookups, token versioning', async () => {
    const s = await setup();
    const u = await s.users.create('Ada@Example.com', ' Ada ', 'hash');
    expect(typeof u.createdAt).toBe('number');
    expect(u.name).toBe('Ada');
    await expect(s.users.create('ada@example.COM', 'Eve', 'h2')).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
    expect((await s.users.findByEmail('ADA@EXAMPLE.COM'))?.id).toBe(u.id);
    expect((await s.users.findById(u.id))?.tokenVersion).toBe(0);
    expect(await s.users.bumpTokenVersion(u.id)).toBe(1);
    expect(await s.users.updatePassword(u.id, 'newhash')).toBe(2);
    expect((await s.users.findById(u.id))?.passwordHash).toBe('newhash');
    expect(await s.users.findById('nope')).toBeUndefined();
    await s.done();
  });

  it('raw adapter reports UniqueViolation and affected row counts', async () => {
    const s = await setup();
    await s.users.create('a@b.co', 'A', 'h');
    await expect(s.sql.run('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', ['x', 'A@B.CO', 'n', 'h', 1])).rejects.toBeInstanceOf(UniqueViolation);
    expect((await s.sql.run('UPDATE users SET name = ? WHERE email = ?', ['Z', 'a@b.co'])).changes).toBe(1);
    expect((await s.sql.run('UPDATE users SET name = ? WHERE email = ?', ['Z', 'none'])).changes).toBe(0);
    await s.done();
  });

  it('farms: demo seeding is idempotent, even when two instances seed at once', async () => {
    const s = await setup();
    await Promise.all([s.farms.seedDemo(), s.farms.seedDemo(), s.farms.seedDemo()]);
    const list = await s.farms.list();
    expect(list.map((f) => f.id).sort()).toEqual(['green-valley', 'indus-basin', 'kenya-dryland', 'midwest-corn']);
    expect(list[0]).toMatchObject({ lat: expect.any(Number), area: expect.any(Number), ownerId: null });
    expect((await s.farms.getProfile('green-valley'))?.soil.soilType).toBe('Sandy Loam');
    await s.done();
  });

  it('farms: ownership, listing order, profile upsert, update and delete cascade', async () => {
    const s = await setup();
    await s.farms.seedDemo();
    const ada = await s.users.create('ada@x.co', 'Ada', 'h');
    const eve = await s.users.create('eve@x.co', 'Eve', 'h');
    const farm = await s.farms.create(ada.id, { label: ' Plot ', lat: 31.5, lon: 74.3, area: 5.5 });
    expect(farm.label).toBe('Plot');
    expect((await s.farms.list(ada.id)).at(-1)?.id).toBe(farm.id); // own farms sort after demo farms
    expect((await s.farms.list(eve.id)).some((f) => f.id === farm.id)).toBe(false);
    await expect(s.farms.getReadable(farm.id, eve.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(s.farms.getWritable('green-valley', ada.id)).rejects.toMatchObject({ statusCode: 403 });
    const prof = { soil: (await s.farms.getProfile('green-valley'))!.soil, currentCrop: 'Maize', waterAvailability: 'Limited' as const, irrigationType: 'Rain-fed' as const, priorities: (await s.farms.getProfile('green-valley'))!.priorities };
    await s.farms.upsertProfile(farm.id, prof);
    expect((await s.farms.upsertProfile(farm.id, { ...prof, currentCrop: 'Wheat' })).currentCrop).toBe('Wheat'); // update path of the upsert
    expect((await s.farms.update(farm.id, { area: 9 })).area).toBe(9);
    await s.farms.delete(farm.id);
    expect(await s.farms.getProfile(farm.id)).toBeUndefined(); // ON DELETE CASCADE
    await s.done();
  });

  it('runs: create/read/list/delete; anonymous purge never touches owned runs', async () => {
    const s = await setup();
    const u = await s.users.create('u@x.co', 'U', 'h');
    const anonOld = await s.runs.create({ engineVersion: '1', input: { a: 1 }, result: { b: 2 } });
    const anonNew = await s.runs.create({ engineVersion: '1', input: {}, result: {} });
    const owned = await s.runs.create({ userId: u.id, engineVersion: '1', input: {}, result: { ok: true } });
    await s.sql.run('UPDATE scenario_runs SET created_at = ? WHERE id IN (?, ?)', [Date.now() - 40 * 86_400_000, anonOld, owned]);
    expect((await s.runs.getAccessible(anonOld)).result).toEqual({ b: 2 });
    await expect(s.runs.getAccessible(owned)).rejects.toMatchObject({ statusCode: 404 });
    expect((await s.runs.getAccessible(owned, u.id)).userId).toBe(u.id);
    expect(await s.runs.purgeAnonymousOlderThan(30 * 86_400_000)).toBe(1);
    await expect(s.runs.getAccessible(anonOld)).rejects.toMatchObject({ statusCode: 404 });
    await s.runs.getAccessible(anonNew);
    const list = await s.runs.listForUser(u.id, 10, 0);
    expect(list.total).toBe(1);
    expect(await s.runs.delete(owned, 'someone-else')).toBe(false);
    expect(await s.runs.delete(owned, u.id)).toBe(true);
    await s.done();
  });

  it('plans: create/list/paginate/update/delete with nullable and JSON fields', async () => {
    const s = await setup();
    const u = await s.users.create('p@x.co', 'P', 'h');
    const a = await s.plans.create(u.id, { name: ' A ', crops: ['Wheat', 'Chickpea'], metrics: { soilHealth: 70 }, overallScore: 72 });
    const b = await s.plans.create(u.id, { name: 'B', crops: ['Maize'] });
    expect(a.name).toBe('A');
    expect(a.overallScore).toBe(72);
    expect(b.metrics).toBeNull();
    expect(b.overallScore).toBeNull();
    expect((await s.plans.list(u.id, { limit: 1, offset: 0 })).total).toBe(2);
    expect((await s.plans.list(u.id, { limit: 1, offset: 1 })).items).toHaveLength(1);
    const upd = await s.plans.update(a.id, u.id, { crops: ['Wheat'], notes: 'n', overallScore: null });
    expect(upd).toMatchObject({ crops: ['Wheat'], notes: 'n', overallScore: null, metrics: { soilHealth: 70 } });
    await expect(s.plans.getOwned(a.id, 'other')).rejects.toMatchObject({ statusCode: 404 });
    expect(await s.plans.delete(a.id, u.id)).toBe(true);
    expect(await s.plans.delete(a.id, u.id)).toBe(false);
    await s.done();
  });

  it('cache: upsert, expiry bookkeeping, 3-newest retention per prefix, stale lookup', async () => {
    const s = await setup();
    for (let i = 0; i < 5; i++) {
      await s.cache.put({ key: `k${i}`, prefix: 'loc', payload: `{"i":${i}}`, source: 'nasa', ttlMs: 60_000 });
      await new Promise((r) => setTimeout(r, 3));
    }
    await s.cache.put({ key: 'other', prefix: 'elsewhere', payload: '{}', source: 'nasa', ttlMs: 1 });
    expect(await s.cache.get('k0')).toBeUndefined(); // pruned
    expect((await s.cache.get('k4'))?.payload).toBe('{"i":4}');
    expect((await s.cache.latestByPrefix('loc'))?.key).toBe('k4');
    await s.cache.put({ key: 'k4', prefix: 'loc', payload: '{"i":"new"}', source: 'nasa', ttlMs: 60_000 }); // conflict path
    expect((await s.cache.get('k4'))?.payload).toBe('{"i":"new"}');
    expect(typeof (await s.cache.get('k4'))!.expiresAt).toBe('number');
    await s.sql.run('UPDATE env_cache SET expires_at = ? WHERE key = ?', [Date.now() - 9 * 86_400_000, 'other']);
    expect(await s.cache.purgeExpiredOlderThan(7 * 86_400_000)).toBe(1);
    await s.sql.housekeeping();
    await s.sql.ping();
    await s.done();
  });
});

describe.skipIf(!PG_URL)('PostgreSQL-specific guarantees', () => {
  it('concurrent instances migrating the same schema create it exactly once (advisory lock)', async () => {
    const schema = pgSchema();
    const make = () => PgAdapter.connect({ url: PG_URL!, max: 2, ssl: false, schema });
    const [a, b, c] = await Promise.all([make(), make(), make()]);
    const results = await Promise.all([a.migrate(), b.migrate(), c.migrate()]);
    expect(results.flat().sort()).toEqual(['1_init', '2_user_token_version', '3_password_resets']); // each migration applied by exactly one instance
    await a.dropSchema();
    await Promise.all([a.close(), b.close(), c.close()]);
  });

  it('schema parity: PostgreSQL has exactly the same tables and columns as SQLite', async () => {
    const lite = SqliteAdapter.open(':memory:');
    await lite.migrate();
    const p = await pg();
    await p.migrate();
    const tables = ['users', 'farms', 'farm_profiles', 'scenario_runs', 'rotation_plans', 'env_cache', 'password_resets'];
    for (const t of tables) {
      const liteCols = (await lite.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name).sort();
      const pgCols = (await p.all<{ column_name: string }>('SELECT column_name FROM information_schema.columns WHERE table_name = ? AND table_schema = current_schema()', [t])).map((c) => c.column_name).sort();
      expect(pgCols, `columns of ${t}`).toEqual(liteCols);
    }
    await p.dropSchema();
    await p.close();
    await lite.close();
  });
});
