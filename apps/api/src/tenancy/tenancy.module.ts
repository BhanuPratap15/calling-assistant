import {
  Controller,
  createParamDecorator,
  type ExecutionContext,
  Get,
  Global,
  Module,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { TenantResolver } from './tenant-resolver.service.js';
import {
  publicBranding,
  type TenantInfo,
  type TenantRequest,
} from './tenant.types.js';

/** Controller me current client: me(@CurrentTenant() tenant: TenantInfo) */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantInfo | undefined =>
    ctx.switchToHttp().getRequest<TenantRequest>().tenant,
);

@Controller('branding')
export class BrandingController {
  /**
   * GET /api/branding — login page / header / theme (login ke bina).
   * Suspended client ka bhi milta hai (login page pe "suspended" dikhane ke liye).
   */
  @Public()
  @Get()
  branding(@Req() req: TenantRequest) {
    if (!req.tenant) throw new NotFoundException('Workspace not found');
    return publicBranding(req.tenant);
  }
}

@Global()
@Module({
  controllers: [BrandingController],
  providers: [TenantResolver],
  exports: [TenantResolver],
})
export class TenancyModule {}
