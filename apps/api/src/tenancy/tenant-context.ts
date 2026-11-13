import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Multi-tenant "context": abhi kis client (organization) ke liye kaam ho raha hai.
 *
 *  - HTTP request: TenantMiddleware Host header se org nikaal ke `runInOrg` karta hai
 *  - Background jobs (scheduler, imports, webhooks): khud `runInOrg(orgId, ...)` karte hain
 *  - Platform admin panel: `runUnscoped` — saare clients (queries me organizationId khud do)
 *
 * PrismaService ka extension har tenant table ki query me `organizationId` isi se lagata hai.
 * Context na ho to query FAIL hoti hai (galti se kisi aur client ka data na dikhe).
 */
export type TenantStore = { orgId: string } | { unscoped: true };

const storage = new AsyncLocalStorage<TenantStore>();

/**
 * fn ko org ke context me chalao. `await` andar hi hota hai — Prisma ki query lazy hoti hai
 * (`.then()` pe chalti hai), isliye context ke bahar await kiya to org nahi milta.
 */
export function runInOrg<T>(
  orgId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  return storage.run({ orgId }, async () => await fn());
}

/** Platform-level code (saare clients). Tenant tables pe filter NAHI lagta — dhyan se use karo */
export function runUnscoped<T>(fn: () => T | Promise<T>): Promise<T> {
  return storage.run({ unscoped: true }, async () => await fn());
}

/** Middleware: sync callback (Express `next`) context ke andar */
export function enterOrg(orgId: string, fn: () => void): void {
  storage.run({ orgId }, fn);
}
export function enterUnscoped(fn: () => void): void {
  storage.run({ unscoped: true }, fn);
}

export function tenantStore(): TenantStore | undefined {
  return storage.getStore();
}

/**
 * Tests / scripts: TENANT_IMPLICIT_ORG_ID set ho to bina context ke yahi org.
 * Production me set MAT karo — context bhool jaana bug hai, use chhupao mat.
 */
function implicitOrgId(): string | undefined {
  return process.env.TENANT_IMPLICIT_ORG_ID || undefined;
}

/** Current org (raw SQL ke filters ke liye). Context nahi → error */
export function currentOrgId(): string {
  const store = storage.getStore();
  if (store && 'orgId' in store) return store.orgId;
  const implicit = implicitOrgId();
  if (implicit && !store) return implicit;
  throw new Error(
    'Tenant context missing (no organization for this operation)',
  );
}

/** Extension ke liye: org id, ya 'unscoped', ya undefined (= error) */
export function resolveScope(): string | 'unscoped' | undefined {
  const store = storage.getStore();
  if (store) return 'unscoped' in store ? 'unscoped' : store.orgId;
  return implicitOrgId();
}

/** Migration ne pehle se mojood data isi org me daala (brand: Addaplay) */
export const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';
