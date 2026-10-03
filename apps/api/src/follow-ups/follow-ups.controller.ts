import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  ListFollowUpsQueryDto,
  ReassignFollowUpDto,
  RescheduleFollowUpDto,
} from './dto/follow-up.dto.js';
import { FollowUpsService } from './follow-ups.service.js';

/**
 * Scope: Assistant → apne; Team Leader → apni team ke; Manager → sab.
 * Follow-up CALL "Start Calling" se hota hai (due follow-ups sabse pehle milte hain).
 */
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly service: FollowUpsService) {}

  @Get()
  findAll(
    @Query() query: ListFollowUpsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user);
  }

  @Post(':id/reschedule')
  @HttpCode(200)
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reschedule(id, dto.dueAt, user);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Post(':id/reassign')
  @HttpCode(200)
  reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reassign(id, dto.staffId, user);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancel(id, user);
  }
}
