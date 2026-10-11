import { randomBytes, randomUUID } from 'node:crypto';

/** Opaque, unguessable identifier (128 bits) with a readable prefix. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}

export function newRequestId(): string {
  return randomUUID();
}

/** URL-safe slug used for user-created farm ids. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
