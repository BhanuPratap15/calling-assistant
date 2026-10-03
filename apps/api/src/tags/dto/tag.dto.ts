import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CATEGORY_COLORS } from '../../categories/dto/category.dto.js';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @IsOptional()
  @IsIn(CATEGORY_COLORS)
  color?: (typeof CATEGORY_COLORS)[number];
}

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @IsIn(CATEGORY_COLORS)
  color?: (typeof CATEGORY_COLORS)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Customer ke tags = ye poori list (replace) */
export class SetCustomerTagsDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  tagIds: string[];
}
