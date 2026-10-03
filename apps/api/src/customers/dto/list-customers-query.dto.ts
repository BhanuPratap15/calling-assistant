import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
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

  // categoryId=<uuid> ya categoryId=none (bina category — abhi rate nahi hue)
  @IsOptional()
  @ValidateIf((_, v) => v !== 'none')
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;

  // sort=rating → highest interest pehle (VIP leads dhundhna)
  @IsOptional()
  @IsIn(['recent', 'rating'])
  sort?: 'recent' | 'rating';
}
