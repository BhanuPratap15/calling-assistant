import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import { ImportRowStatus, ImportStatus } from '../../generated/prisma/enums.js';

export class ListImportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportStatus)
  status?: ImportStatus;
}

export class ListImportRowsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportRowStatus)
  status?: ImportRowStatus;
}

/** Confirm pe optional: naye customers seedhe campaign me daalo / tag lagao */
export class ConfirmImportDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;
}
