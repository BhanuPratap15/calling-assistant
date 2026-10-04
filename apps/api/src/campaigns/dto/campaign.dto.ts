import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import {
  CampaignFieldType,
  CampaignStatus,
  Priority,
} from '../../generated/prisma/enums.js';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  script?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  script?: string;

  // null = date hatao
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;
}

export class ListCampaignsQueryDto {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}

/** Kaun call karega (poori list replace). Dono khaali = sab call kar sakte hain. */
export class SetMembersDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  staffIds: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  teamIds: string[];
}

/**
 * Customers add karo — seedhe IDs se YA filter se ("saare High Interest", "tag = Big Spender").
 * Filter me sirf ACTIVE customers aate hain (DO_NOT_CALL kabhi nahi).
 */
export class CustomerFilterDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== 'none')
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  // true = sirf jinko kabhi call nahi hua (fresh leads)
  @IsOptional()
  @IsBoolean()
  neverCalled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class AddCustomersDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  customerIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerFilterDto)
  filter?: CustomerFilterDto;
}

export class RemoveCustomersDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID('all', { each: true })
  customerIds: string[];
}

export class ListCampaignCustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['all', 'pending', 'called'])
  state: 'all' | 'pending' | 'called' = 'all';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CampaignFieldInputDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  key: string; // format check: validateFieldDefinitions

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @IsEnum(CampaignFieldType)
  type: CampaignFieldType;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  options: string[];

  @IsBoolean()
  required: boolean;

  @IsBoolean()
  isActive: boolean;

  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder: number;
}

export class SaveFieldsDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CampaignFieldInputDto)
  fields: CampaignFieldInputDto[];
}
