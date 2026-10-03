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
import {
  CreateTagDto,
  SetCustomerTagsDto,
  UpdateTagDto,
} from './dto/tag.dto.js';
import { TagsService } from './tags.service.js';

@Controller()
export class TagsController {
  constructor(private readonly service: TagsService) {}

  @Get('tags')
  findAll() {
    return this.service.findAll();
  }

  @Roles('MANAGER')
  @Post('tags')
  create(@Body() dto: CreateTagDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Roles('MANAGER')
  @Patch('tags/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTagDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  // PUT /api/customers/:id/tags { tagIds } — poori list replace
  @Roles('MANAGER', 'TEAM_LEADER', 'ASSISTANT')
  @Put('customers/:id/tags')
  setCustomerTags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCustomerTagsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setCustomerTags(id, dto.tagIds, user);
  }
}
