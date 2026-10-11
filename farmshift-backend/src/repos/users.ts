import type { SqlAdapter } from '../db/adapter.js';
import { UniqueViolation } from '../db/adapter.js';
import { AppError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  tokenVersion: number;
  createdAt: number;
}
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

const map = (r: Record<string, unknown>): UserRow => ({
  id: r.id as string,
  email: r.email as string,
  name: r.name as string,
  passwordHash: r.password_hash as string,
  tokenVersion: Number(r.token_version ?? 0),
  createdAt: Number(r.created_at),
});

export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: new Date(u.createdAt).toISOString(),
});

export class UsersRepo {
  constructor(private db: SqlAdapter) {}

  async create(email: string, name: string, passwordHash: string): Promise<UserRow> {
    const id = newId('usr');
    const createdAt = Date.now();
    try {
      await this.db.run('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, email.trim(), name.trim(), passwordHash, createdAt]);
    } catch (e) {
      if (e instanceof UniqueViolation) throw AppError.conflict('An account with this email already exists');
      throw e;
    }
    return { id, email: email.trim(), name: name.trim(), passwordHash, tokenVersion: 0, createdAt };
  }

  async findByEmail(email: string): Promise<UserRow | undefined> {
    const r = await this.db.get('SELECT * FROM users WHERE lower(email) = lower(?)', [email.trim()]);
    return r ? map(r) : undefined;
  }

  async findById(id: string): Promise<UserRow | undefined> {
    const r = await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
    return r ? map(r) : undefined;
  }

  /** Invalidate all tokens issued so far. Returns the new version. */
  async bumpTokenVersion(id: string): Promise<number> {
    await this.db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]);
    return (await this.findById(id))!.tokenVersion;
  }

  /** Set a new password hash and invalidate all existing tokens. Returns the new token version. */
  async updatePassword(id: string, passwordHash: string): Promise<number> {
    await this.db.run('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [passwordHash, id]);
    return (await this.findById(id))!.tokenVersion;
  }
}
