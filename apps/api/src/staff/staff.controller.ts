import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { ListStaffQueryDto } from './dto/list-staff-query.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { StaffService } from './staff.service.js';

/**
 * Staff management — sirf MANAGER (aur SUPER_ADMIN).
 * Manager sirf TEAM_LEADER / ASSISTANT ko manage kar sakta hai (dekho staff-permissions.ts).
 */
@Roles('MANAGER')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthUser) {
    return this.staffService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: ListStaffQueryDto) {
    return this.staffService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.staffService.update(id, dto, user);
  }

  // Admin kisi ka password set kare (bhool gaya ho to). 204 = success, body nahi.
  @Post(':id/reset-password')
  @HttpCode(204)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.staffService.resetPassword(id, dto.newPassword, user);
  }
}
