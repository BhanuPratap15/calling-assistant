import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { TeamsService } from './teams.service.js';

/**
 * Teams: Manager banata/badalta hai; Team Leader sirf apni teams dekh sakta hai.
 * Member add/remove = staff ka teamId badlo (PATCH /api/staff/:id { teamId }).
 */
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Roles('MANAGER')
  @Post()
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: AuthUser) {
    return this.teamsService.create(dto, user);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.teamsService.findAll(user);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.teamsService.findOne(id, user);
  }

  @Roles('MANAGER')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.teamsService.update(id, dto, user);
  }
}
