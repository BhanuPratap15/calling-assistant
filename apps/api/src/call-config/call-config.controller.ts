import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CallConfigService } from './call-config.service.js';
import {
  CreateCallOutcomeDto,
  CreateNextActionDto,
  UpdateCallOutcomeDto,
  UpdateNextActionDto,
  UpdateRequiredFieldsDto,
} from './dto/call-config.dto.js';

/**
 * Call form settings.
 *  GET  /api/call-config        → koi bhi logged-in (assistant ka form isse banega)
 *  GET  /api/call-config/admin  → Manager (inactive options bhi)
 *  baaki (create/update)        → Manager
 */
@Controller('call-config')
export class CallConfigController {
  constructor(private readonly service: CallConfigService) {}

  @Get()
  getConfig() {
    return this.service.getConfig();
  }

  @Roles('MANAGER')
  @Get('admin')
  getAdminConfig() {
    return this.service.getConfig(true);
  }

  @Roles('MANAGER')
  @Post('outcomes')
  createOutcome(
    @Body() dto: CreateCallOutcomeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createOutcome(dto, user);
  }

  @Roles('MANAGER')
  @Patch('outcomes/:id')
  updateOutcome(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCallOutcomeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateOutcome(id, dto, user);
  }

  @Roles('MANAGER')
  @Post('next-actions')
  createNextAction(
    @Body() dto: CreateNextActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createNextAction(dto, user);
  }

  @Roles('MANAGER')
  @Patch('next-actions/:id')
  updateNextAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNextActionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateNextAction(id, dto, user);
  }

  // PUT = poori setting replace (teeno fields bhejo)
  @Roles('MANAGER')
  @Put('required-fields')
  updateRequiredFields(
    @Body() dto: UpdateRequiredFieldsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateRequiredFields(dto, user);
  }
}
