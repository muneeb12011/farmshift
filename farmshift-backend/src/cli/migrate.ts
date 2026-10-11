import { loadEnv } from '../config/env.js';
import { openSql } from '../services/container.js';

const env = loadEnv();
const sql = await openSql(env);
const applied = await sql.migrate();
console.log(applied.length ? `Applied: ${applied.join(', ')}` : `Database (${sql.dialect}) is up to date.`);
await sql.close();
