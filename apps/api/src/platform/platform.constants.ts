/** Theme presets — web (apps/web/src/lib/theme.ts) me inke rang hain. Naya preset = dono jagah. */
export const THEME_PRESETS = [
  'violet',
  'indigo',
  'blue',
  'sky',
  'teal',
  'emerald',
  'green',
  'amber',
  'orange',
  'red',
  'rose',
  'pink',
  'slate',
] as const;

export const SIDEBAR_STYLES = ['dark', 'light', 'brand'] as const;
export const LOGIN_STYLES = ['split', 'centered'] as const;

/** Subdomain me ye naam nahi (system ke kaam ke) */
export const RESERVED_SLUGS = [
  'www',
  'api',
  'app',
  'admin',
  'platform',
  'mail',
  'smtp',
  'ftp',
  'static',
  'assets',
  'cdn',
  'status',
  'monitor',
  'support',
  'help',
];

export const SLUG_RULE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/** crm.acme.com — har label 1-63, letters / digits / hyphen; kam se kam ek dot */
export const HOSTNAME_RULE =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Logo / favicon: chhota data URL (DB me save hota hai — CDN ki zaroorat nahi) */
export const IMAGE_DATA_URL_RULE =
  /^data:image\/(png|jpeg|webp|svg\+xml|x-icon|vnd\.microsoft\.icon|gif);base64,[A-Za-z0-9+/=]+$/;
export const MAX_IMAGE_DATA_URL_LENGTH = 400_000; // ~300 KB file

export const PLATFORM_COOKIE = 'platform_token';

export const PlatformAction = {
  LOGIN: 'platform.login',
  LOGIN_FAILED: 'platform.login_failed',
  PASSWORD_CHANGED: 'platform.password_changed',
  ADMIN_CREATED: 'platform_admin.created',
  ADMIN_UPDATED: 'platform_admin.updated',
  ORG_CREATED: 'organization.created',
  ORG_UPDATED: 'organization.updated',
  ORG_SUSPENDED: 'organization.suspended',
  ORG_ACTIVATED: 'organization.activated',
  DOMAIN_ADDED: 'domain.added',
  DOMAIN_REMOVED: 'domain.removed',
  DOMAIN_PRIMARY: 'domain.primary_set',
  DOMAIN_RECHECK: 'domain.recheck',
  DOMAIN_SYNCED: 'domain.synced',
  TENANT_ADMIN_CREATED: 'tenant_admin.created',
  TENANT_PASSWORD_RESET: 'tenant_staff.password_reset',
} as const;
export type PlatformAction =
  (typeof PlatformAction)[keyof typeof PlatformAction];
