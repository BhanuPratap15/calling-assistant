import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { tenantSelect, type TenantInfo } from './tenant.types.js';

const CACHE_MS = 30_000;

/**
 * Host (web address) → client (organization).
 *   1. organization_domains me exact hostname (custom domain / subdomain)
 *   2. <slug>.<PLATFORM_BASE_DOMAIN>  (e.g. acme.crm.example.com, local: acme.localhost)
 *   3. TENANT_FALLBACK_SLUG (default "default") — purana single-client setup / IP se access.
 *      Production me sab domains set ho jaayein to TENANT_FALLBACK_SLUG= (khaali) karke band karo.
 *
 * 30s cache (har request pe DB nahi). Platform panel se badlaav → invalidate().
 */
@Injectable()
export class TenantResolver {
  private readonly byHost = new Map<
    string,
    { value: TenantInfo | null; at: number }
  >();
  private readonly byId = new Map<string, { value: TenantInfo; at: number }>();
  readonly baseDomain: string | undefined;
  private readonly fallbackSlug: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.baseDomain =
      config.get<string>('PLATFORM_BASE_DOMAIN')?.trim().toLowerCase() ||
      undefined;
    const fallback = config.get<string>('TENANT_FALLBACK_SLUG');
    this.fallbackSlug =
      fallback === undefined ? 'default' : fallback.trim() || undefined;
  }

  async resolve(host: string): Promise<TenantInfo | null> {
    const hit = this.byHost.get(host);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await this.lookup(host);
    this.byHost.set(host, { value, at: Date.now() });
    if (value) this.byId.set(value.id, { value, at: Date.now() });
    return value;
  }

  /** Current org ki settings (dialer, limits) — cache ke saath */
  async byOrgId(id: string): Promise<TenantInfo | null> {
    const hit = this.byId.get(id);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
    const value = await this.prisma.organization.findUnique({
      where: { id },
      select: tenantSelect,
    });
    if (value) this.byId.set(id, { value, at: Date.now() });
    return value;
  }

  invalidate() {
    this.byHost.clear();
    this.byId.clear();
  }

  /** acme.<base> → "acme" (sirf ek level; www / platform jaise reserved nahi) */
  slugFromHost(host: string): string | undefined {
    if (!this.baseDomain || !host.endsWith(`.${this.baseDomain}`))
      return undefined;
    const slug = host.slice(0, -(this.baseDomain.length + 1));
    return /^[a-z0-9-]+$/.test(slug) ? slug : undefined;
  }

  private async lookup(host: string): Promise<TenantInfo | null> {
    if (host) {
      const domain = await this.prisma.organizationDomain.findUnique({
        where: { hostname: host },
        select: { organization: { select: tenantSelect } },
      });
      if (domain) return domain.organization;
      const slug = this.slugFromHost(host);
      if (slug) {
        const org = await this.prisma.organization.findUnique({
          where: { slug },
          select: tenantSelect,
        });
        if (org) return org;
        return null; // galat subdomain → "workspace not found" (fallback nahi)
      }
    }
    if (!this.fallbackSlug) return null;
    return this.prisma.organization.findUnique({
      where: { slug: this.fallbackSlug },
      select: tenantSelect,
    });
  }
}
