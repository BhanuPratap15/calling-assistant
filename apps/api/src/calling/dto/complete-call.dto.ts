import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * "Save & Next" ka body. Kaunsa optional field kab zaroori hai,
 * ye Settings ke rules decide karte hain (call-form-validation.ts) — DTO sirf format check karta hai.
 */
export class CompleteCallDto {
  @IsUUID()
  outcomeId: string;

  @IsUUID()
  nextActionId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userResponse?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  interestRating?: number;

  @IsOptional()
  @Type(() => Date) // "2026-10-03T16:00:00+05:30" → Date
  @IsDate()
  followUpAt?: Date;
}
