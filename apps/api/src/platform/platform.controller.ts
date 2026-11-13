import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import {
  AddDomainDto,
  CreateOrganizationDto,
  CreatePlatformAdminDto,
  DomainSyncReportDto,
  ListOrganizationsQueryDto,
  PlatformChangePasswordDto,
  PlatformLoginDto,
  SetOrganizationStatusDto,
  TenantAdminInputDto,
  UpdateOrganizationDto,
  UpdatePlatformAdminDto,
} from './dto/platform.dto.js';
import { OrganizationsService } from './organizations.service.js';
import {
  CurrentPlatformUser,
  PlatformAuthGuard,
  PlatformAuthService,
  platformCookieOptions,
  type PlatformUser,
} from './platform-auth.js';
import { PlatformAuditService } from './platform-audit.service.js';
import { PLATFORM_COOKIE } from './platform.constants.js';

/**
 * /api/platform/* — platform panel (aap). Staff ka JwtAuthGuard nahi (@Public),
 * iska apna PlatformAuthGuard. TenantMiddleware in routes ko UNSCOPED chalata hai.
 */
@Public()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: PlatformLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password, req.ip);
    this.auth.setCookie(res, result);
    return result;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(
      (req.cookies as Record<string, string> | undefined)?.[PLATFORM_COOKIE],
    );
    res.clearCookie(PLATFORM_COOKIE, platformCookieOptions());
  }

  @UseGuards(PlatformAuthGuard)
  @Get('me')
  me(@CurrentPlatformUser() user: PlatformUser) {
    return user;
  }

  @UseGuards(PlatformAuthGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentPlatformUser() user: PlatformUser,
    @Body() dto: PlatformChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    this.auth.setCookie(res, token);
    return token;
  }
}

@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly orgs: OrganizationsService,
    private readonly auth: PlatformAuthService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Get('overview')
  overview() {
    return this.orgs.overview();
  }

  // ---------- organizations ----------

  @Get('organizations')
  list(@Query() q: ListOrganizationsQueryDto) {
    return this.orgs.list(q);
  }

  @Post('organizations')
  create(
    @CurrentPlatformUser() user: PlatformUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.orgs.create(user, dto);
  }

  @Get('organizations/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgs.get(id);
  }

  @Patch('organizations/:id')
  update(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgs.update(user, id, dto);
  }

  @Post('organizations/:id/status')
  @HttpCode(200)
  setStatus(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetOrganizationStatusDto,
  ) {
    return this.orgs.setStatus(user, id, dto.status);
  }

  @Get('organizations/:id/audit-logs')
  orgAudit(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.list(id);
  }

  // ---------- domains ----------

  @Post('organizations/:id/domains')
  addDomain(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDomainDto,
  ) {
    return this.orgs.addDomain(user, id, dto);
  }

  @Delete('organizations/:id/domains/:domainId')
  removeDomain(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.orgs.removeDomain(user, id, domainId);
  }

  @Post('organizations/:id/domains/:domainId/primary')
  @HttpCode(200)
  setPrimary(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.orgs.setPrimaryDomain(user, id, domainId);
  }

  @Post('organizations/:id/domains/:domainId/recheck')
  @HttpCode(200)
  recheck(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.orgs.recheckDomain(user, id, domainId);
  }

  @Get('organizations/:id/domains/:domainId/dns')
  dns(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('domainId', ParseUUIDPipe) domainId: string,
  ) {
    return this.orgs.checkDns(id, domainId);
  }

  // ---------- client admins ----------

  @Post('organizations/:id/admins')
  createAdmin(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TenantAdminInputDto,
  ) {
    return this.orgs.createTenantAdmin(user, id, dto);
  }

  @Post('organizations/:id/staff/:staffId/reset-password')
  @HttpCode(200)
  resetPassword(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ) {
    return this.orgs.resetStaffPassword(user, id, staffId);
  }

  // ---------- platform team ----------

  @Get('admins')
  admins() {
    return this.auth.listAdmins();
  }

  @Post('admins')
  addAdmin(
    @CurrentPlatformUser() user: PlatformUser,
    @Body() dto: CreatePlatformAdminDto,
  ) {
    return this.auth.createAdmin(user, dto);
  }

  @Patch('admins/:adminId')
  updateAdmin(
    @CurrentPlatformUser() user: PlatformUser,
    @Param('adminId', ParseUUIDPipe) adminId: string,
    @Body() dto: UpdatePlatformAdminDto,
  ) {
    return this.auth.setAdminActive(user, adminId, dto.isActive ?? true);
  }

  @Get('audit-logs')
  auditLogs() {
    return this.audit.list(undefined, 200);
  }
}

/**
 * Server ki script (ops/platform/sync-domains.sh, cron har minute) — domains ke SSL certificate.
 * Login nahi: header `X-Sync-Token` = PLATFORM_SYNC_TOKEN. Token set nahi → endpoint band (404).
 */
@Public()
@Controller('platform/domain-sync')
export class DomainSyncController {
  private readonly token: string | undefined;

  constructor(
    private readonly orgs: OrganizationsService,
    config: ConfigService,
  ) {
    const token = config.get<string>('PLATFORM_SYNC_TOKEN')?.trim();
    this.token = token && token.length >= 24 ? token : undefined;
  }

  private check(header: string | undefined) {
    if (!this.token) throw new NotFoundException();
    const a = Buffer.from(header ?? '');
    const b = Buffer.from(this.token);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new UnauthorizedException('Invalid sync token');
  }

  /** text/plain: har line "hostname status" (shell script ke liye aasaan) */
  @Get('domains')
  async domains(
    @Headers('x-sync-token') token: string | undefined,
    @Res() res: Response,
  ) {
    this.check(token);
    const rows = await this.orgs.syncList();
    res
      .type('text/plain')
      .send(rows.map((r) => `${r.hostname} ${r.status}`).join('\n') + '\n');
  }

  @Post('report')
  @HttpCode(200)
  report(
    @Headers('x-sync-token') token: string | undefined,
    @Body() dto: DomainSyncReportDto,
  ) {
    this.check(token);
    return this.orgs.syncReport(dto.hostname, dto.status, dto.error);
  }
}
