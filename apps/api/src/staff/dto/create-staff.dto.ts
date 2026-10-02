import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsValidPassword } from '../../auth/decorators/is-valid-password.decorator.js';
import { StaffRole } from '../../generated/prisma/enums.js';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsValidPassword()
  password: string; // initial password — staff baad me khud badal sakta hai

  @IsEnum(StaffRole)
  role: StaffRole;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}
