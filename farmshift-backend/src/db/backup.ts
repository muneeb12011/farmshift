import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Db } from './sqlite-adapter.js';

/**
 * Consistent online snapshot using SQLite's VACUUM INTO (safe while the server is running; also compacts).
 * Returns the path written. Files are named farmshift-YYYYMMDD-HHMMSS.db so they sort chronologically.
 */
export function backupDatabase(db: Db, dir: string, now: Date = new Date()): string {
  mkdirSync(dir, { recursive: true });
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const file = resolve(join(dir, `farmshift-${stamp}.db`));
  db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  return file;
}

/** Keep only the newest `keep` backups in `dir`. Returns the deleted file names. */
export function pruneBackups(dir: string, keep: number): string[] {
  const files = readdirSync(dir)
    .filter((f) => /^farmshift-\d{8}-\d{6}\.db$/.test(f))
    .sort()
    .reverse();
  const doomed = files.slice(Math.max(1, keep));
  for (const f of doomed) rmSync(join(dir, f));
  return doomed;
}

export const sizeOf = (file: string) => statSync(file).size;
