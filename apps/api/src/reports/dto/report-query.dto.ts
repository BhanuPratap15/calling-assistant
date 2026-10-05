import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { RANGE_PRESETS, type RangePreset } from '../report-range.js';

/** ?range=7d | today | yesterday | 30d | custom&from=2026-10-01&to=2026-10-05 + optional filters */
export class ReportQueryDto {
  @IsOptional()
  @IsIn(RANGE_PRESETS)
  range: RangePreset = '7d';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @IsUUID()
  staffId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export const EXPORT_TYPES = ['calls', 'assistants', 'campaigns'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];
