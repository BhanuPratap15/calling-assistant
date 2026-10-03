import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Priority } from '../../generated/prisma/enums.js';

export const CATEGORY_COLORS = [
  'gray',
  'blue',
  'green',
  'yellow',
  'red',
  'indigo',
] as const;

export class CategoryInputDto {
  @IsOptional()
  @IsUUID()
  id?: string; // hai = update, nahi = naya

  @Matches(/^[A-Z][A-Z0-9_]{1,49}$/, {
    message: 'code must be UPPER_SNAKE_CASE',
  })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @IsInt()
  @Min(0)
  @Max(10)
  minRating: number;

  @IsInt()
  @Min(0)
  @Max(10)
  maxRating: number;

  @IsIn(CATEGORY_COLORS)
  color: (typeof CATEGORY_COLORS)[number];

  // null = priority mat chhedo
  @ValidateIf((_, v) => v !== null)
  @IsEnum(Priority)
  priority: Priority | null;

  @IsBoolean()
  isActive: boolean;

  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder: number;
}

/** Saari categories ek saath (ranges ek doosre pe depend karti hain — overlap check poore set pe) */
export class SaveCategoriesDto {
  @ValidateNested({ each: true })
  @Type(() => CategoryInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  categories: CategoryInputDto[];
}
