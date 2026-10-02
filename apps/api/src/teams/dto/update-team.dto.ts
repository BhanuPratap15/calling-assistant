import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // null = leader hatao
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  leaderId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
