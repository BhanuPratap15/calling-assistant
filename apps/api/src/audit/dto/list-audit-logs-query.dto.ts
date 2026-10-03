import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import { AUDIT_ENTITY_TYPES, AuditAction } from '../audit.types.js';

// GET /api/audit-logs?entityType=customer&entityId=...&actorId=...&action=customer.updated&from=2026-10-01&to=2026-10-31
export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsIn(Object.values(AuditAction))
  action?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
