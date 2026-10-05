import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  EXPORT_TYPES,
  type ExportType,
  ReportQueryDto,
} from './dto/report-query.dto.js';
import { ReportsService } from './reports.service.js';

/**
 * Dashboard + reports. Scope apne aap: ASSISTANT = khud, TEAM_LEADER = apni team, MANAGER = sab.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** KPIs + daily trend + hour-wise + outcomes + follow-up health (assistant ko apne numbers) */
  @Roles('MANAGER', 'TEAM_LEADER', 'ASSISTANT')
  @Get('summary')
  summary(@CurrentUser() user: AuthUser, @Query() q: ReportQueryDto) {
    return this.reports.summary(user, q);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get('assistants')
  assistants(@CurrentUser() user: AuthUser, @Query() q: ReportQueryDto) {
    return this.reports.assistants(user, q);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get('campaigns')
  campaigns(@CurrentUser() user: AuthUser, @Query() q: ReportQueryDto) {
    return this.reports.campaigns(user, q);
  }

  /** GET /reports/export/calls.csv | assistants.csv | campaigns.csv (same filters) */
  @Roles('MANAGER', 'TEAM_LEADER')
  @Get('export/:file')
  async export(
    @Param('file') file: string,
    @CurrentUser() user: AuthUser,
    @Query() q: ReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const type = file.replace(/\.csv$/, '') as ExportType;
    if (!EXPORT_TYPES.includes(type))
      throw new BadRequestException(
        `Export must be one of: ${EXPORT_TYPES.map((t) => `${t}.csv`).join(', ')}`,
      );
    const csv = await this.reports.exportCsv(user, type, q);
    const stamp = q.range === 'custom' ? `${q.from}_to_${q.to}` : q.range;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${type}-${stamp}.csv"`,
    );
    return csv;
  }
}
