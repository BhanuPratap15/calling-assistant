import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CampaignsService } from './campaigns.service.js';
import {
  AddCustomersDto,
  CreateCampaignDto,
  ListCampaignCustomersQueryDto,
  ListCampaignsQueryDto,
  RemoveCustomersDto,
  SaveFieldsDto,
  SetMembersDto,
  UpdateCampaignDto,
} from './dto/campaign.dto.js';

/** Campaigns: Manager manage karta hai; Team Leader dekh sakta hai */
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get()
  findAll(@Query() query: ListCampaignsQueryDto) {
    return this.service.findAll(query);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get(':id/customers')
  listCustomers(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListCampaignCustomersQueryDto,
  ) {
    return this.service.listCustomers(id, query);
  }

  @Roles('MANAGER')
  @Post()
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Roles('MANAGER')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Roles('MANAGER')
  @Put(':id/members')
  setMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMembersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setMembers(id, dto, user);
  }

  @Roles('MANAGER')
  @Post(':id/customers')
  addCustomers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCustomersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addCustomers(id, dto, user);
  }

  // POST (DELETE body kuch proxies drop kar dete hain)
  @Roles('MANAGER')
  @Post(':id/customers/remove')
  removeCustomers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveCustomersDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.removeCustomers(id, dto.customerIds, user);
  }

  @Roles('MANAGER')
  @Put(':id/fields')
  saveFields(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveFieldsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.saveFields(id, dto, user);
  }
}
