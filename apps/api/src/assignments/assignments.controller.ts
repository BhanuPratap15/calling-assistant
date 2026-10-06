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
import { AssignmentsService } from './assignments.service.js';
import {
  CreateAssignmentDto,
  DistributeDto,
  ListAssignmentsQueryDto,
  ReassignDto,
} from './dto/assignment.dto.js';

/** Manual assignment — Manager (sab), Team Leader (sirf apni team) */
@Roles('MANAGER', 'TEAM_LEADER')
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly service: AssignmentsService) {}

  @Get()
  findAll(
    @Query() query: ListAssignmentsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user);
  }

  // Assign/Reassign dropdown ke options (role ke hisaab se scoped)
  @Get('assignable-staff')
  assignableStaff(@CurrentUser() user: AuthUser) {
    return this.service.assignableStaff(user);
  }

  @Post()
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  // Bulk: round-robin / load-based (dryRun=true → preview)
  @Post('distribute')
  @HttpCode(200)
  distribute(@Body() dto: DistributeDto, @CurrentUser() user: AuthUser) {
    return this.service.distribute(dto, user);
  }

  @Post(':id/reassign')
  @HttpCode(200)
  reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reassign(id, dto.staffId, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancel(id, user);
  }
}
