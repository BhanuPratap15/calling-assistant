import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

/** Har logged-in staff sirf APNI notifications dekhta hai */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('unread', new ParseBoolPipe({ optional: true })) unread?: boolean,
  ) {
    return this.service.list(user.id, unread ?? false);
  }

  // Header 🔔 badge — frontend har 30 sec me poochta hai (polling)
  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.unreadCount(user.id);
  }

  @Post('read-all')
  @HttpCode(204)
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.service.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.markRead(id, user.id);
  }
}
