/** Client (organization) ki public branding — API: GET /api/branding (host se) */
export interface Branding {
  slug: string | null;
  /** NOT_FOUND = is address pe koi client nahi; UNKNOWN = API se pata nahi chala */
  status: 'ACTIVE' | 'SUSPENDED' | 'NOT_FOUND' | 'UNKNOWN';
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
}

/** Jab koi client nahi mila (platform-only domain / API band) */
export const DEFAULT_BRANDING: Branding = {
  slug: null,
  status: 'UNKNOWN',
  brandName: 'Calling CRM',
  tagline: null,
  logoUrl: null,
  faviconUrl: null,
  themePreset: 'violet',
  primaryColor: null,
  sidebarStyle: 'dark',
  loginStyle: 'split',
  supportEmail: null,
  supportPhone: null,
};

/** "Acme Calling" → "AC" (logo na ho to) */
export function brandInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'C'
  );
}
