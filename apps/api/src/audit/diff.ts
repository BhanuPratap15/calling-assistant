import type { AuditChanges } from './audit.types.js';

// Ye fields kabhi audit me nahi jaayenge (value ki jagah sirf "badla" likhna ho to alag action use karo)
const NEVER_LOG = new Set(['passwordHash', 'password', 'updatedAt']);

/** Date, null, object — sabko compare-able string me */
const normalize = (value: unknown): unknown =>
  value instanceof Date ? value.toISOString() : (value ?? null);

/**
 * Before aur after compare karke sirf BADLE hue fields lautata hai.
 *   diffChanges({ name: 'A', phone: '1' }, { name: 'B', phone: '1' }, ['name', 'phone'])
 *   → { name: { from: 'A', to: 'B' } }
 * Kuch nahi badla → undefined.
 */
export function diffChanges<T extends object>(
  before: T,
  after: T,
  fields: (keyof T & string)[],
): AuditChanges | undefined {
  const changes: AuditChanges = {};
  for (const field of fields) {
    if (NEVER_LOG.has(field)) continue;
    const from = normalize(before[field]);
    const to = normalize(after[field]);
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[field] = { from, to };
    }
  }
  return Object.keys(changes).length ? changes : undefined;
}
