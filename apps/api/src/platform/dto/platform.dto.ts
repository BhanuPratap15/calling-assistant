import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsValidPassword } from '../../auth/decorators/is-valid-password.decorator.js';
import {
  DialerMode,
  OrganizationStatus,
} from '../../generated/prisma/enums.js';
import {
  HOSTNAME_RULE,
  IMAGE_DATA_URL_RULE,
  LOGIN_STYLES,
  MAX_IMAGE_DATA_URL_LENGTH,
  SIDEBAR_STYLES,
  SLUG_RULE,
  THEME_PRESETS,
} from '../platform.constants.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
/** "" → null (form ka khaali field = hatao) */
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });
const emptyToNullLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? null : lower({ value });

const SLUG_MESSAGE =
  'slug: 1-32 lowercase letters, digits or hyphens (not at start / end)';

// ---------------- auth ----------------

export class PlatformLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class PlatformChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsValidPassword()
  newPassword: string;
}

export class CreatePlatformAdminDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(lower)
  @IsEmail()
  email: string;

  @IsValidPassword()
  password: string;
}

export class UpdatePlatformAdminDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ---------------- organization settings (create + update share these) ----------------

class OrganizationSettingsDto {
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(200)
  tagline?: string | null;

  /** data:image/...;base64 (null = hatao) */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(MAX_IMAGE_DATA_URL_LENGTH, {
    message: 'logo must be under ~300 KB',
  })
  @Matches(IMAGE_DATA_URL_RULE, {
    message: 'logo must be a PNG / JPG / WEBP / SVG image',
  })
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(MAX_IMAGE_DATA_URL_LENGTH, {
    message: 'favicon must be under ~300 KB',
  })
  @Matches(IMAGE_DATA_URL_RULE, {
    message: 'favicon must be a PNG / ICO / SVG image',
  })
  faviconUrl?: string | null;

  @IsOptional()
  @IsIn(THEME_PRESETS)
  themePreset?: string;

  /** #RRGGBB — preset ki jagah apna rang (null = preset hi) */
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'primaryColor must be like #4F46E5',
  })
  primaryColor?: string | null;

  @IsOptional()
  @IsIn(SIDEBAR_STYLES)
  sidebarStyle?: string;

  @IsOptional()
  @IsIn(LOGIN_STYLES)
  loginStyle?: string;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  supportEmail?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(30)
  supportPhone?: string | null;

  @IsOptional()
  @IsEnum(DialerMode)
  dialerMode?: DialerMode;

  /** EXTERNAL_PANEL: client ke dialer panel ka https link */
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @Matches(/^https:\/\/[^\s]+$/, {
    message: 'externalDialerUrl must start with https://',
  })
  @MaxLength(500)
  externalDialerUrl?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(50)
  plan?: string | null;

  /** null = unlimited */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStaff?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(100)
  contactName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsEmail()
  contactEmail?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(30)
  contactPhone?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class TenantAdminInputDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(lower)
  @IsEmail()
  email: string;

  /** Khaali = system random password banata hai (response me ek baar dikhta hai) */
  @IsOptional()
  @IsValidPassword()
  password?: string;
}

export class CreateOrganizationDto extends OrganizationSettingsDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @Transform(lower)
  @Matches(SLUG_RULE, { message: SLUG_MESSAGE })
  slug: string;

  /** Khaali = name */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  brandName?: string;

  /** Client ka apna domain (e.g. crm.acme.com) — baad me bhi add kar sakte hain */
  @IsOptional()
  @Transform(emptyToNullLower)
  @ValidateIf((_, v) => v !== null)
  @Matches(HOSTNAME_RULE, {
    message: 'customDomain must be a valid domain like crm.acme.com',
  })
  customDomain?: string | null;

  /** Client ka pehla Super Admin */
  @ValidateNested()
  @Type(() => TenantAdminInputDto)
  admin: TenantAdminInputDto;
}

export class UpdateOrganizationDto extends OrganizationSettingsDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(lower)
  @Matches(SLUG_RULE, { message: SLUG_MESSAGE })
  slug?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  brandName?: string;
}

export class SetOrganizationStatusDto {
  @IsEnum(OrganizationStatus)
  status: OrganizationStatus;
}

export class ListOrganizationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;
}

// ---------------- domains ----------------

export class AddDomainDto {
  @Transform(lower)
  @Matches(HOSTNAME_RULE, {
    message: 'hostname must be a valid domain like crm.acme.com',
  })
  hostname: string;
}

export class DomainSyncReportDto {
  @Transform(lower)
  @IsString()
  hostname: string;

  /** PENDING = DNS abhi is server pe nahi (error me wajah) */
  @IsIn(['ACTIVE', 'FAILED', 'PENDING'])
  status: 'ACTIVE' | 'FAILED' | 'PENDING';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  error?: string;
}
