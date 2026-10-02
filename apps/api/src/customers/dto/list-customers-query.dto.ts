import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import { CustomerStatus, Priority } from '../../generated/prisma/enums.js';

// GET /api/customers?search=rahul&status=ACTIVE&priority=HIGH&page=1&pageSize=20
export class ListCustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string; // naam ya phone me dhundo

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
