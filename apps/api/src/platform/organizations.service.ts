import { randomBytes } from 'node:crypto';
import { resolve4, resolveCname } from 'node:dns/promises';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '../auth/password.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { OrganizationStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TenantResolver } from '../tenancy/tenant-resolver.service.js';
import type {
  AddDomainDto,
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  TenantAdminInputDto,
  UpdateOrganizationDto,
} from './dto/platform.dto.js';
import { seedOrganizationDefaults } from './org-defaults.js';
import type { PlatformUser } from './platform-auth.js';
import { PlatformAuditService } from './platform-audit.service.js';
import { PlatformAction, RESERVED_SLUGS } from './platform.constants.js';

/** Settings jo create / update dono me aate hain (DTO → DB columns same naam) */
const SETTING_FIELDS = [
  'tagline',
  'logoUrl',
  'faviconUrl',
  'themePreset',
  'primaryColor',
  'sidebarStyle',
  'loginStyle',
  'supportEmail',
  'supportPhone',
  'dialerMode',
  'externalDialerUrl',
  'plan',
  'maxStaff',
  'contactName',
  'contactEmail',
  'contactPhone',
  'notes',
] as const;

/** Audit me logo ka poora data URL nahi — sirf "badla" */
const IMAGE_FIELDS = new Set(['logoUrl', 'faviconUrl']);

const domainSelect = {
  id: true,
  hostname: true,
  type: true,
  status: true,
  isPrimary: true,
  error: true,
  checkedAt: true,
  createdAt: true,
} satisfies Prisma.OrganizationDomainSelect;

/** Padhne / bolne layak random password: 3 letter-groups + digits (policy: letter + number) */
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out}${(bytes[10] % 90) + 10}`;
}

/**
 * Platform panel: clients (organizations) ka poora lifecycle.
 * Ye code UNSCOPED context me chalta hai (TenantMiddleware /api/platform pe) —
 * tenant tables pe `organizationId` hamesha khud do.
 */
@Injectable()
export class OrganizationsService {
  readonly baseDomain: string | undefined;
  private readonly serverIps: string[];
  private readonly serverCname: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: TenantResolver,
    private readonly audit: PlatformAuditService,
    config: ConfigService,
  ) {
    this.baseDomain = tenants.baseDomain;
    this.serverIps = (config.get<string>('PLATFORM_SERVER_IP') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.serverCname =
      config.get<string>('PLATFORM_CNAME_TARGET')?.trim().toLowerCase() ||
      (this.baseDomain ? `app.${this.baseDomain}` : undefined);
  }

  /** UI ke liye: domains kaise point karein */
  dnsInstructions() {
    return {
      baseDomain: this.baseDomain ?? null,
      serverIps: this.serverIps,
      cnameTarget: this.serverCname ?? null,
    };
  }

  // ---------------- list / overview ----------------

  async list(q: ListOrganizationsQueryDto) {
    const orgs = await this.prisma.organization.findMany({
      where: {
        ...(q.status ? { status: q.status } : {}),
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { slug: { contains: q.search, mode: 'insensitive' } },
                { brandName: { contains: q.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        brandName: true,
        logoUrl: true,
        themePreset: true,
        primaryColor: true,
        plan: true,
        maxStaff: true,
        dialerMode: true,
        createdAt: true,
        domains: { select: domainSelect, orderBy: { isPrimary: 'desc' } },
      },
    });
    const usage = await this.usage(orgs.map((o) => o.id));
    return orgs.map((o) => ({ ...o, usage: usage.get(o.id) ?? emptyUsage() }));
  }

  async overview() {
    const [byStatus, staff, calls30, domainsPending] = await Promise.all([
      this.prisma.organization.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.staff.count({ where: { isActive: true } }),
      this.prisma.call.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      }),
      this.prisma.organizationDomain.count({
        where: { status: { not: 'ACTIVE' } },
      }),
    ]);
    const count = (s: OrganizationStatus) =>
      byStatus.find((b) => b.status === s)?._count._all ?? 0;
    return {
      organizations: { active: count('ACTIVE'), suspended: count('SUSPENDED') },
      activeStaff: staff,
      callsLast30Days: calls30,
      domainsPending,
      dns: this.dnsInstructions(),
    };
  }

  /** Har client: staff, customers, calls (30 din), aakhri call / login */
  private async usage(ids: string[]) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [staff, customers, calls, lastCall, lastLogin] = await Promise.all([
      this.prisma.staff.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: ids }, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.customer.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.call.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: ids }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.call.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: ids } },
        _max: { createdAt: true },
      }),
      this.prisma.staff.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: ids } },
        _max: { lastLoginAt: true },
      }),
    ]);
    const map = new Map<string, ReturnType<typeof emptyUsage>>();
    for (const id of ids) map.set(id, emptyUsage());
    for (const r of staff)
      map.get(r.organizationId)!.activeStaff = r._count._all;
    for (const r of customers)
      map.get(r.organizationId)!.customers = r._count._all;
    for (const r of calls)
      map.get(r.organizationId)!.callsLast30Days = r._count._all;
    for (const r of lastCall)
      map.get(r.organizationId)!.lastCallAt = r._max.createdAt;
    for (const r of lastLogin)
      map.get(r.organizationId)!.lastLoginAt = r._max.lastLoginAt;
    return map;
  }

  // ---------------- one organization ----------------

  async get(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        domains: { select: domainSelect, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    const usage = (await this.usage([id])).get(id)!;
    const admins = await this.prisma.staff.findMany({
      where: { organizationId: id, role: { in: ['SUPER_ADMIN', 'MANAGER'] } },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return { ...org, usage, admins, dns: this.dnsInstructions() };
  }

  private assertSlugAllowed(slug: string) {
    if (RESERVED_SLUGS.includes(slug))
      throw new BadRequestException(
        `"${slug}" is reserved — choose another slug`,
      );
  }

  private settingsData(
    dto: Partial<Record<(typeof SETTING_FIELDS)[number], unknown>>,
  ) {
    const data: Record<string, unknown> = {};
    for (const f of SETTING_FIELDS) if (dto[f] !== undefined) data[f] = dto[f];
    return data as Prisma.OrganizationUncheckedUpdateInput;
  }

  private checkDialer(mode: unknown, url: unknown) {
    if (mode === 'EXTERNAL_PANEL' && !url)
      throw new BadRequestException(
        'External dialer panel needs its link (externalDialerUrl)',
      );
  }

  async create(actor: PlatformUser, dto: CreateOrganizationDto) {
    this.assertSlugAllowed(dto.slug);
    this.checkDialer(dto.dialerMode, dto.externalDialerUrl);
    const hostnames = [
      ...(this.baseDomain
        ? [
            {
              hostname: `${dto.slug}.${this.baseDomain}`,
              type: 'SUBDOMAIN' as const,
            },
          ]
        : []),
      ...(dto.customDomain
        ? [{ hostname: dto.customDomain, type: 'CUSTOM' as const }]
        : []),
    ];
    const password = dto.admin.password ?? generatePassword();
    const passwordHash = await hashPassword(password);

    const org = await this.conflicts(() =>
      this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            ...(this.settingsData(
              dto,
            ) as Prisma.OrganizationUncheckedCreateInput),
            name: dto.name,
            slug: dto.slug,
            brandName: dto.brandName || dto.name,
          },
        });
        if (hostnames.length)
          await tx.organizationDomain.createMany({
            data: hostnames.map((h, i) => ({
              ...h,
              organizationId: org.id,
              // Custom domain ho to wahi primary (client ke users wahi kholenge)
              isPrimary: dto.customDomain ? h.type === 'CUSTOM' : i === 0,
            })),
          });
        await seedOrganizationDefaults(tx, org.id);
        const admin = await tx.staff.create({
          data: {
            organizationId: org.id,
            name: dto.admin.name,
            email: dto.admin.email,
            passwordHash,
            role: 'SUPER_ADMIN',
            mustChangePassword: true, // pehle login pe client khud badle
          },
        });
        await this.audit.record(
          {
            actorId: actor.id,
            action: PlatformAction.ORG_CREATED,
            organizationId: org.id,
            metadata: {
              slug: org.slug,
              admin: admin.email,
              domains: hostnames.map((h) => h.hostname),
            },
          },
          tx,
        );
        return org;
      }),
    );
    this.tenants.invalidate();
    return {
      organization: await this.get(org.id),
      adminCredentials: {
        email: dto.admin.email,
        password,
        loginUrl: await this.loginUrl(org.id),
      },
    };
  }

  async update(actor: PlatformUser, id: string, dto: UpdateOrganizationDto) {
    const before = await this.prisma.organization.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Organization not found');
    if (dto.slug && dto.slug !== before.slug) this.assertSlugAllowed(dto.slug);
    this.checkDialer(
      dto.dialerMode ?? before.dialerMode,
      dto.externalDialerUrl === undefined
        ? before.externalDialerUrl
        : dto.externalDialerUrl,
    );
    const data: Record<string, unknown> = {
      ...(this.settingsData(dto) as object),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
      ...(dto.brandName !== undefined ? { brandName: dto.brandName } : {}),
    };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [k, v] of Object.entries(data)) {
      const prev = (before as Record<string, unknown>)[k];
      if (prev === v) continue;
      changes[k] = IMAGE_FIELDS.has(k)
        ? { from: prev ? 'image' : null, to: v ? 'image' : null }
        : { from: prev, to: v };
    }
    if (!Object.keys(changes).length) return this.get(id);

    await this.conflicts(() =>
      this.prisma.$transaction(async (tx) => {
        await tx.organization.update({ where: { id }, data });
        // Slug badla → subdomain bhi
        if (dto.slug && dto.slug !== before.slug && this.baseDomain) {
          await tx.organizationDomain.updateMany({
            where: {
              organizationId: id,
              hostname: `${before.slug}.${this.baseDomain}`,
            },
            data: {
              hostname: `${dto.slug}.${this.baseDomain}`,
              status: 'PENDING',
              error: null,
            },
          });
        }
        await this.audit.record(
          {
            actorId: actor.id,
            action: PlatformAction.ORG_UPDATED,
            organizationId: id,
            changes: changes as Prisma.InputJsonValue,
          },
          tx,
        );
      }),
    );
    this.tenants.invalidate();
    return this.get(id);
  }

  async setStatus(actor: PlatformUser, id: string, status: OrganizationStatus) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status === status) return this.get(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id }, data: { status } });
      if (status === 'SUSPENDED') {
        // Sab logged-in users turant bahar (tokens bekaar)
        await tx.staff.updateMany({
          where: { organizationId: id },
          data: { tokenVersion: { increment: 1 }, availability: 'OFFLINE' },
        });
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action:
            status === 'SUSPENDED'
              ? PlatformAction.ORG_SUSPENDED
              : PlatformAction.ORG_ACTIVATED,
          organizationId: id,
        },
        tx,
      );
    });
    this.tenants.invalidate();
    return this.get(id);
  }

  // ---------------- domains ----------------

  async addDomain(actor: PlatformUser, id: string, dto: AddDomainDto) {
    await this.ensureOrg(id);
    if (
      this.baseDomain &&
      (dto.hostname === this.baseDomain ||
        (dto.hostname.endsWith(`.${this.baseDomain}`) &&
          this.tenants.slugFromHost(dto.hostname) !== undefined))
    ) {
      throw new BadRequestException(
        `Subdomains of ${this.baseDomain} come from the slug — change the slug instead`,
      );
    }
    const hasPrimary = await this.prisma.organizationDomain.count({
      where: { organizationId: id, isPrimary: true },
    });
    const domain = await withUniqueConflict(
      () =>
        this.prisma.organizationDomain.create({
          data: {
            organizationId: id,
            hostname: dto.hostname,
            type: 'CUSTOM',
            isPrimary: hasPrimary === 0,
          },
          select: domainSelect,
        }),
      'This domain is already used by a workspace',
    );
    await this.audit.record({
      actorId: actor.id,
      action: PlatformAction.DOMAIN_ADDED,
      organizationId: id,
      metadata: { hostname: dto.hostname },
    });
    this.tenants.invalidate();
    return domain;
  }

  async removeDomain(actor: PlatformUser, id: string, domainId: string) {
    const domain = await this.findDomain(id, domainId);
    if (domain.type === 'SUBDOMAIN')
      throw new BadRequestException('The built-in subdomain cannot be removed');
    await this.prisma.$transaction(async (tx) => {
      await tx.organizationDomain.delete({ where: { id: domainId } });
      if (domain.isPrimary) {
        const next = await tx.organizationDomain.findFirst({
          where: { organizationId: id },
          orderBy: { createdAt: 'asc' },
        });
        if (next)
          await tx.organizationDomain.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action: PlatformAction.DOMAIN_REMOVED,
          organizationId: id,
          metadata: { hostname: domain.hostname },
        },
        tx,
      );
    });
    this.tenants.invalidate();
    return { removed: true };
  }

  async setPrimaryDomain(actor: PlatformUser, id: string, domainId: string) {
    const domain = await this.findDomain(id, domainId);
    await this.prisma.$transaction([
      this.prisma.organizationDomain.updateMany({
        where: { organizationId: id },
        data: { isPrimary: false },
      }),
      this.prisma.organizationDomain.update({
        where: { id: domainId },
        data: { isPrimary: true },
      }),
    ]);
    await this.audit.record({
      actorId: actor.id,
      action: PlatformAction.DOMAIN_PRIMARY,
      organizationId: id,
      metadata: { hostname: domain.hostname },
    });
    return this.get(id);
  }

  /** "Retry SSL" — sync script agli baar phir try kare */
  async recheckDomain(actor: PlatformUser, id: string, domainId: string) {
    const domain = await this.findDomain(id, domainId);
    await this.prisma.organizationDomain.update({
      where: { id: domainId },
      data: { status: 'PENDING', error: null },
    });
    await this.audit.record({
      actorId: actor.id,
      action: PlatformAction.DOMAIN_RECHECK,
      organizationId: id,
      metadata: { hostname: domain.hostname },
    });
    return this.get(id);
  }

  /** DNS sahi point kar raha hai? (A record server IP pe / CNAME hamare target pe) */
  async checkDns(id: string, domainId: string) {
    const domain = await this.findDomain(id, domainId);
    const [a, cname] = await Promise.all([
      resolve4(domain.hostname).catch(() => [] as string[]),
      resolveCname(domain.hostname).catch(() => [] as string[]),
    ]);
    const cnames = cname.map((c) => c.toLowerCase().replace(/\.$/, ''));
    const pointsHere =
      (this.serverIps.length > 0 &&
        a.some((ip) => this.serverIps.includes(ip))) ||
      (!!this.serverCname && cnames.includes(this.serverCname));
    return {
      hostname: domain.hostname,
      aRecords: a,
      cnameRecords: cnames,
      expected: this.dnsInstructions(),
      pointsHere: this.serverIps.length || this.serverCname ? pointsHere : null,
    };
  }

  // ---------------- client admins ----------------

  async createTenantAdmin(
    actor: PlatformUser,
    id: string,
    dto: TenantAdminInputDto,
  ) {
    const org = await this.ensureOrg(id);
    await this.assertStaffLimit(org.id, org.maxStaff);
    const password = dto.password ?? generatePassword();
    const admin = await withUniqueConflict(
      async () =>
        this.prisma.staff.create({
          data: {
            organizationId: id,
            name: dto.name,
            email: dto.email,
            passwordHash: await hashPassword(password),
            role: 'SUPER_ADMIN',
            mustChangePassword: true,
          },
          select: { id: true, name: true, email: true, role: true },
        }),
      'A user with this email already exists in this workspace',
    );
    await this.audit.record({
      actorId: actor.id,
      action: PlatformAction.TENANT_ADMIN_CREATED,
      organizationId: id,
      metadata: { staffId: admin.id, email: admin.email },
    });
    return {
      admin,
      credentials: {
        email: admin.email,
        password,
        loginUrl: await this.loginUrl(id),
      },
    };
  }

  /** Client ka admin password bhool gaya → naya temporary password (pehle login pe badalna) */
  async resetStaffPassword(actor: PlatformUser, id: string, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, organizationId: id },
    });
    if (!staff) throw new NotFoundException('User not found in this workspace');
    if (!['SUPER_ADMIN', 'MANAGER'].includes(staff.role))
      throw new ForbiddenException(
        'Only workspace admins / managers can be reset from here — they can reset their own staff',
      );
    const password = generatePassword();
    await this.prisma.staff.update({
      where: { id: staffId },
      data: {
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        isActive: true,
        tokenVersion: { increment: 1 },
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: PlatformAction.TENANT_PASSWORD_RESET,
      organizationId: id,
      metadata: { staffId, email: staff.email },
    });
    return {
      credentials: {
        email: staff.email,
        password,
        loginUrl: await this.loginUrl(id),
      },
    };
  }

  /** Staff limit (plan) — tenant ka StaffService bhi yahi check karta hai */
  async assertStaffLimit(organizationId: string, maxStaff: number | null) {
    if (maxStaff === null) return;
    const active = await this.prisma.staff.count({
      where: { organizationId, isActive: true },
    });
    if (active >= maxStaff)
      throw new ConflictException(
        `Staff limit reached (${maxStaff} active users on this plan)`,
      );
  }

  // ---------------- domain sync (server script) ----------------

  syncList() {
    return this.prisma.organizationDomain.findMany({
      orderBy: { createdAt: 'asc' },
      select: { hostname: true, status: true },
    });
  }

  async syncReport(
    hostname: string,
    status: 'ACTIVE' | 'FAILED' | 'PENDING',
    error?: string,
  ) {
    const domain = await this.prisma.organizationDomain.findUnique({
      where: { hostname },
    });
    if (!domain) throw new NotFoundException('Unknown domain');
    await this.prisma.organizationDomain.update({
      where: { hostname },
      data: {
        status,
        error:
          status === 'ACTIVE'
            ? null
            : (error ?? 'Certificate could not be issued').slice(0, 1000),
        checkedAt: new Date(),
      },
    });
    if (domain.status !== status)
      await this.audit.record({
        actorId: null,
        action: PlatformAction.DOMAIN_SYNCED,
        organizationId: domain.organizationId,
        metadata: { hostname, status, error: error?.slice(0, 300) ?? null },
      });
    return { ok: true };
  }

  // ---------------- helpers ----------------

  private async ensureOrg(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  private async findDomain(id: string, domainId: string) {
    const domain = await this.prisma.organizationDomain.findFirst({
      where: { id: domainId, organizationId: id },
    });
    if (!domain) throw new NotFoundException('Domain not found');
    return domain;
  }

  /** Client ka login link (primary domain; warna subdomain) */
  async loginUrl(id: string): Promise<string | null> {
    const domain = await this.prisma.organizationDomain.findFirst({
      where: { organizationId: id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return domain ? `https://${domain.hostname}/login` : null;
  }

  private async conflicts<T>(save: () => Promise<T>): Promise<T> {
    try {
      return await save();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = JSON.stringify(error.meta ?? {});
        if (target.includes('slug'))
          throw new ConflictException('This slug is already taken');
        if (target.includes('hostname'))
          throw new ConflictException(
            'This domain is already used by a workspace',
          );
        throw new ConflictException('Already exists');
      }
      throw error;
    }
  }
}

function emptyUsage() {
  return {
    activeStaff: 0,
    customers: 0,
    callsLast30Days: 0,
    lastCallAt: null as Date | null,
    lastLoginAt: null as Date | null,
  };
}
