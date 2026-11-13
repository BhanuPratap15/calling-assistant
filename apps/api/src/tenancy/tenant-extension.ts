import { Prisma } from '../generated/prisma/client.js';
import { resolveScope } from './tenant-context.js';

/** Jin tables me organization_id hai (Prisma model names) */
export const TENANT_MODELS = new Set<string>([
  'Staff',
  'Team',
  'Customer',
  'AuditLog',
  'CallOutcome',
  'NextAction',
  'SystemSetting',
  'Assignment',
  'Call',
  'FollowUp',
  'Notification',
  'Category',
  'CustomerCategoryChange',
  'Tag',
  'CustomerTag',
  'Campaign',
  'CampaignCustomer',
  'CampaignStaff',
  'CampaignTeam',
  'CampaignField',
  'ImportBatch',
  'ImportRow',
  'CallSession',
  'CallEvent',
]);

const WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

type Args = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
};

const NESTED_OPS = ['create', 'createMany', 'connectOrCreate', 'upsert'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    !(v instanceof Date) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

/** Relation write object ({ create: ... }) — sirf relation operations ke keys hon */
function isRelationWrite(v: Record<string, unknown>): boolean {
  const keys = Object.keys(v);
  return (
    keys.some((k) => NESTED_OPS.includes(k)) &&
    keys.every((k) =>
      [
        ...NESTED_OPS,
        'connect',
        'set',
        'disconnect',
        'delete',
        'update',
        'updateMany',
        'deleteMany',
      ].includes(k),
    )
  );
}

const many = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);

/** Ek row ka data: org + nested creates me bhi org (e.g. campaign.create({ staff: { create: [...] } })) */
function withOrg(data: unknown, orgId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { ...(data as object) };
  for (const [key, value] of Object.entries(row)) {
    if (!isPlainObject(value) || !isRelationWrite(value)) continue;
    const rel: Record<string, unknown> = { ...value };
    if (rel.create !== undefined)
      rel.create = Array.isArray(rel.create)
        ? rel.create.map((d) => withOrg(d, orgId))
        : withOrg(rel.create, orgId);
    if (isPlainObject(rel.createMany))
      rel.createMany = {
        ...rel.createMany,
        data: many(rel.createMany.data).map((d) => withOrg(d, orgId)),
      };
    for (const op of ['connectOrCreate', 'upsert'] as const) {
      if (rel[op] === undefined) continue;
      const items = many(
        rel[op] as Record<string, unknown> | Record<string, unknown>[],
      ).map((x) => ({
        ...x,
        create: withOrg(x.create, orgId),
      }));
      rel[op] = Array.isArray(rel[op]) ? items : items[0];
    }
    row[key] = rel;
  }
  row.organizationId = orgId;
  return row;
}

/** Ek operation ke args me org lagao (pure function — unit test hota hai) */
export function scopeArgs(
  operation: string,
  args: Args | undefined,
  orgId: string,
): Args {
  const next: Args = { ...args };
  if (WHERE_OPS.has(operation)) {
    next.where = { ...next.where, organizationId: orgId };
  } else if (operation === 'create') {
    next.data = withOrg(next.data, orgId);
  } else if (
    operation === 'createMany' ||
    operation === 'createManyAndReturn'
  ) {
    next.data = many(next.data).map((d) => withOrg(d, orgId));
  } else if (operation === 'upsert') {
    next.where = { ...next.where, organizationId: orgId };
    next.create = withOrg(next.create, orgId);
  } else {
    throw new Error(`Tenant scoping not implemented for "${operation}"`);
  }
  return next;
}

/**
 * Har tenant-table query me `organizationId = current org` automatically.
 * (Raw SQL — $queryRaw — pe nahi lagta: wahan `currentOrgId()` se filter khud likho.)
 */
export const tenantExtension = Prisma.defineExtension({
  name: 'tenant-scope',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args);
        const scope = resolveScope();
        if (scope === 'unscoped') return query(args);
        if (!scope) {
          throw new Error(
            `Tenant context missing for ${model}.${operation} (wrap in runInOrg)`,
          );
        }
        return query(scopeArgs(operation, args as Args, scope) as never);
      },
    },
  },
});
