/** Platform panel (white-label SaaS) — API /api/platform/* ke types */

export type OrgStatus = 'ACTIVE' | 'SUSPENDED';
export type DialerMode = 'PLATFORM' | 'EXTERNAL_PANEL' | 'PHONE';
export type DomainStatus = 'PENDING' | 'ACTIVE' | 'FAILED';

export const DIALER_MODES: Record<
  DialerMode,
  { label: string; description: string }
> = {
  PLATFORM: {
    label: 'Our dialer (integrated)',
    description:
      'Click-to-call from the CRM with live status, talk time and recordings.',
  },
  EXTERNAL_PANEL: {
    label: "Client's own dialer panel",
    description:
      'Callers copy the number and dial from the client’s existing dialer website. Notes, follow-ups and reports stay in the CRM.',
  },
  PHONE: {
    label: 'Mobile / softphone (tel: link)',
    description: 'The call button opens the phone app on the caller’s device.',
  },
};

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
}

export interface OrgDomain {
  id: string;
  hostname: string;
  type: 'SUBDOMAIN' | 'CUSTOM';
  status: DomainStatus;
  isPrimary: boolean;
  error: string | null;
  checkedAt: string | null;
  createdAt: string;
}

export interface OrgUsage {
  activeStaff: number;
  customers: number;
  callsLast30Days: number;
  lastCallAt: string | null;
  lastLoginAt: string | null;
}

export interface OrgSettings {
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
  plan: string | null;
  maxStaff: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
}

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  brandName: string;
  logoUrl: string | null;
  themePreset: string;
  primaryColor: string | null;
  plan: string | null;
  maxStaff: number | null;
  dialerMode: DialerMode;
  createdAt: string;
  domains: OrgDomain[];
  usage: OrgUsage;
}

export interface DnsInfo {
  baseDomain: string | null;
  serverIps: string[];
  cnameTarget: string | null;
}

export interface OrgAdmin {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MANAGER';
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface OrgDetail extends OrgSettings {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  brandName: string;
  createdAt: string;
  updatedAt: string;
  domains: OrgDomain[];
  usage: OrgUsage;
  admins: OrgAdmin[];
  dns: DnsInfo;
}

export interface Credentials {
  email: string;
  password: string;
  loginUrl: string | null;
}

export interface PlatformOverview {
  organizations: { active: number; suspended: number };
  activeStaff: number;
  callsLast30Days: number;
  domainsPending: number;
  dns: DnsInfo;
}

export interface PlatformAuditEntry {
  id: string;
  action: string;
  organizationId: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export const DOMAIN_TONE: Record<DomainStatus, 'green' | 'yellow' | 'red'> = {
  ACTIVE: 'green',
  PENDING: 'yellow',
  FAILED: 'red',
};

export const DOMAIN_LABEL: Record<DomainStatus, string> = {
  ACTIVE: 'Live (HTTPS)',
  PENDING: 'Waiting for DNS / SSL',
  FAILED: 'SSL failed',
};

/** Slug suggestion: "Acme Corp Pvt Ltd" → "acme-corp-pvt-ltd" (max 32) */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '');
}

/** File (logo / favicon) → data URL, max ~300 KB */
export function readImageFile(file: File, maxBytes = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (
      !/^image\/(png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon|gif)$/.test(
        file.type,
      )
    )
      return reject(
        new Error('Please choose a PNG, JPG, WEBP, SVG or ICO image'),
      );
    if (file.size > maxBytes)
      return reject(
        new Error(`Image is too large (max ${Math.round(maxBytes / 1000)} KB)`),
      );
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
}

export const ACTION_LABELS: Record<string, string> = {
  'platform.login': 'Logged in',
  'platform.login_failed': 'Failed login',
  'platform.password_changed': 'Changed password',
  'platform_admin.created': 'Added platform admin',
  'platform_admin.updated': 'Updated platform admin',
  'organization.created': 'Created client',
  'organization.updated': 'Updated client settings',
  'organization.suspended': 'Suspended client',
  'organization.activated': 'Activated client',
  'domain.added': 'Added domain',
  'domain.removed': 'Removed domain',
  'domain.primary_set': 'Changed primary domain',
  'domain.recheck': 'Retried SSL',
  'domain.synced': 'SSL status changed',
  'tenant_admin.created': 'Added client admin',
  'tenant_staff.password_reset': 'Reset client admin password',
};
