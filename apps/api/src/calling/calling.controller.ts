import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CallingService } from './calling.service.js';
import { CompleteCallDto } from './dto/complete-call.dto.js';

/** Assistant ki calling screen ke APIs. Response me `null` = abhi koi customer nahi. */
@Roles('ASSISTANT', 'TEAM_LEADER')
@Controller('calling')
export class CallingController {
  constructor(private readonly calling: CallingService) {}

  // GET /api/calling/current → current customer (ya null)
  @Get('current')
  async current(@CurrentUser() user: AuthUser) {
    return { current: await this.calling.current(user.id) };
  }

  // POST /api/calling/next → "Start Calling"
  @Post('next')
  @HttpCode(200)
  async next(@CurrentUser() user: AuthUser) {
    return { current: await this.calling.next(user) };
  }

  // POST /api/calling/complete → "Save & Next"
  @Post('complete')
  @HttpCode(200)
  async complete(@CurrentUser() user: AuthUser, @Body() dto: CompleteCallDto) {
    const { call, next } = await this.calling.complete(user, dto);
    return { call, current: next };
  }
}
