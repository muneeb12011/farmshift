import { loadEnv } from '../config/env.js';
import { FarmsRepo } from '../repos/farms.js';
import { openSql } from '../services/container.js';

// Demo farms are also seeded automatically on server start; this is for explicit/CI use. Idempotent.
const env = loadEnv();
const sql = await openSql(env);
await sql.migrate();
const farms = new FarmsRepo(sql);
await farms.seedDemo();
console.log(`Demo farms present: ${(await farms.list()).map((f) => f.id).join(', ')}`);
await sql.close();
