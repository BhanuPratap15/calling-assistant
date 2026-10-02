import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { StaffRole } from '../../generated/prisma/enums.js';

// Email aur password yahan nahi badalte (password ke liye alag reset API)
export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  // null bhejo = team se hatao; undefined (field hi nahi) = mat chhedo
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // false = deactivate (login band, history bachi)
}
