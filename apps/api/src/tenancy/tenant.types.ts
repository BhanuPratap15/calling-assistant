import type { Request } from 'express';
import type {
  DialerMode,
  OrganizationStatus,
} from '../generated/prisma/enums.js';

/** Request ke saath chalne wala client info (TenantMiddleware set karta hai) */
export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  brandName: string;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  themePreset: string;
  primaryColor: string | null;
  sidebarStyle: string;
  loginStyle: string;
  supportEmail: string | null;
  supportPhone: string | null;
  dialerMode: DialerMode;
  externalDialerUrl: string | null;
  maxStaff: number | null;
}

export const tenantSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  brandName: true,
  tagline: true,
  logoUrl: true,
  faviconUrl: true,
  themePreset: true,
  primaryColor: true,
  sidebarStyle: true,
  loginStyle: true,
  supportEmail: true,
  supportPhone: true,
  dialerMode: true,
  externalDialerUrl: true,
  maxStaff: true,
} as const;

export type TenantRequest = Request & { tenant?: TenantInfo };

/** Public branding (login page / header / theme) — internal fields nahi */
export function publicBranding(t: TenantInfo) {
  return {
    slug: t.slug,
    status: t.status,
    brandName: t.brandName,
    tagline: t.tagline,
    logoUrl: t.logoUrl,
    faviconUrl: t.faviconUrl,
    themePreset: t.themePreset,
    primaryColor: t.primaryColor,
    sidebarStyle: t.sidebarStyle,
    loginStyle: t.loginStyle,
    supportEmail: t.supportEmail,
    supportPhone: t.supportPhone,
  };
}

/**
 * Request ka host (port ke bina, lowercase). Proxy (Nginx / Next.js rewrite) ke peeche
 * X-Forwarded-Host. Koi ise fake kare to bhi sirf doosre client ka LOGIN page milta hai —
 * cookie / token us host ke nahi hote, isliye data nahi.
 */
export function requestHost(req: Request): string {
  const raw =
    (req.headers['x-forwarded-host'] as string | undefined) ??
    req.headers.host ??
    '';
  return normalizeHostname(raw.split(',')[0]);
}

export function normalizeHostname(raw: string): string {
  let host = raw.trim().toLowerCase();
  if (host.startsWith('[')) return host; // IPv6 — tenant domain nahi hota
  host = host.replace(/:\d+$/, '').replace(/\.$/, '');
  return host;
}
