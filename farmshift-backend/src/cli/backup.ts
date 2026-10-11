/**
 * Online backup of the SQLite database.
 *   npm run backup                       -> ./backups, keep the newest 14
 *   npm run backup -- /var/backups 30    -> custom directory and retention
 * Safe to run while the server is up (e.g. from cron).
 * PostgreSQL deployments back up with pg_dump (see docs/DEPLOYMENT.md); this command refuses to run for them.
 */
import { loadEnv } from '../config/env.js';
import { backupDatabase, pruneBackups, sizeOf } from '../db/backup.js';
import { openDatabase } from '../db/sqlite-adapter.js';

const env = loadEnv();
if (env.DATABASE_URL) {
  console.error('DATABASE_URL is set (PostgreSQL). Use pg_dump, e.g.:  pg_dump "$DATABASE_URL" -Fc -f farmshift.dump');
  process.exit(1);
}
if (env.DATABASE_PATH === ':memory:') {
  console.error('DATABASE_PATH is :memory:, nothing to back up.');
  process.exit(1);
}
const dir = process.argv[2] ?? './backups';
const keep = Number(process.argv[3] ?? 14);
const db = openDatabase(env.DATABASE_PATH);
const file = backupDatabase(db, dir);
const pruned = pruneBackups(dir, keep);
db.close();
console.log(`Backup written: ${file} (${(sizeOf(file) / 1024).toFixed(0)} KiB)${pruned.length ? `; pruned ${pruned.length} old` : ''}`);
