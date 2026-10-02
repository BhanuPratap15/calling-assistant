import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CustomerStatus, Priority } from '../../generated/prisma/enums.js';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  // Format check service me hota hai (normalizePhone) — yahan sirf "string hai" check
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalId?: string;

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
