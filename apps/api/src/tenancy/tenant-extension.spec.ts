import {
  currentOrgId,
  resolveScope,
  runInOrg,
  runUnscoped,
} from './tenant-context.js';
import { scopeArgs } from './tenant-extension.js';
import { normalizeHostname } from './tenant.types.js';

const ORG = 'org-a';

describe('scopeArgs (tenant extension)', () => {
  it('adds organizationId to where for reads / updates / deletes', () => {
    for (const op of [
      'findMany',
      'findUnique',
      'count',
      'updateMany',
      'delete',
      'groupBy',
    ]) {
      expect(scopeArgs(op, { where: { id: 'x' } }, ORG).where).toEqual({
        id: 'x',
        organizationId: ORG,
      });
    }
    // where na ho tab bhi (findMany() = poori table → sirf is org ki)
    expect(scopeArgs('findMany', undefined, ORG).where).toEqual({
      organizationId: ORG,
    });
  });

  it('overrides a different organizationId passed by the caller', () => {
    expect(
      scopeArgs('findFirst', { where: { organizationId: 'org-b' } }, ORG).where,
    ).toEqual({ organizationId: ORG });
  });

  it('sets organizationId on create / createMany / upsert', () => {
    expect(scopeArgs('create', { data: { name: 'A' } }, ORG).data).toEqual({
      name: 'A',
      organizationId: ORG,
    });
    expect(
      scopeArgs('createMany', { data: [{ name: 'A' }, { name: 'B' }] }, ORG)
        .data,
    ).toEqual([
      { name: 'A', organizationId: ORG },
      { name: 'B', organizationId: ORG },
    ]);
    const upsert = scopeArgs(
      'upsert',
      { where: { id: '1' }, create: { name: 'A' }, update: { name: 'B' } },
      ORG,
    );
    expect(upsert.where).toEqual({ id: '1', organizationId: ORG });
    expect(upsert.create).toEqual({ name: 'A', organizationId: ORG });
    expect(upsert.update).toEqual({ name: 'B' });
  });

  it('sets organizationId on nested creates', () => {
    const args = scopeArgs(
      'create',
      {
        data: {
          name: 'Campaign',
          staff: { create: [{ staffId: 's1' }] },
          customers: { createMany: { data: [{ customerId: 'c1' }] } },
          customFields: { create: 'not-a-relation-but-json', other: 1 },
        },
      },
      ORG,
    );
    const data = args.data as Record<string, any>;
    expect(data.organizationId).toBe(ORG);
    expect(data.staff.create).toEqual([{ staffId: 's1', organizationId: ORG }]);
    expect(data.customers.createMany.data).toEqual([
      { customerId: 'c1', organizationId: ORG },
    ]);
    // JSON value jisme "create" key ho (relation write nahi) — chhedna nahi
    expect(data.customFields).toEqual({
      create: 'not-a-relation-but-json',
      other: 1,
    });
  });

  it('refuses unknown operations instead of silently skipping the filter', () => {
    expect(() => scopeArgs('somethingNew', {}, ORG)).toThrow(/not implemented/);
  });
});

describe('tenant context', () => {
  it('keeps the org across awaits and isolates parallel runs', async () => {
    const seen = await Promise.all([
      runInOrg('a', async () => {
        await new Promise((r) => setTimeout(r, 5));
        return currentOrgId();
      }),
      runInOrg('b', async () => currentOrgId()),
    ]);
    expect(seen).toEqual(['a', 'b']);
  });

  it('has no org outside a context (and unscoped is explicit)', async () => {
    expect(resolveScope()).toBeUndefined();
    expect(() => currentOrgId()).toThrow(/Tenant context missing/);
    expect(await runUnscoped(() => resolveScope())).toBe('unscoped');
  });
});

describe('normalizeHostname', () => {
  it.each([
    ['CRM.Acme.com:443', 'crm.acme.com'],
    ['acme.localhost:3000', 'acme.localhost'],
    ['crm.acme.com.', 'crm.acme.com'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeHostname(input)).toBe(expected);
  });
});
