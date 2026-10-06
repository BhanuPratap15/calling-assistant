import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { REQUIRED_RULES, type RequiredRule } from '../call-config.types.js';

// code: UPPER_SNAKE_CASE, e.g. "CALLBACK_REQUESTED" — reports/integrations isi se pehchante hain
const CODE_RULE = /^[A-Z][A-Z0-9_]{1,49}$/;
const CODE_MESSAGE = 'code must be UPPER_SNAKE_CASE, e.g. CALLBACK_REQUESTED';

class BaseOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

class BaseUpdateOptionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // delete nahi — deactivate (purani calls ka record bacha rahe)
}

export class CreateCallOutcomeDto extends BaseOptionDto {
  @Matches(CODE_RULE, { message: CODE_MESSAGE })
  code: string;

  @IsOptional()
  @IsBoolean()
  isConnected?: boolean;
}

// code update nahi hota (reports toot jaayenge) — label badlo
export class UpdateCallOutcomeDto extends BaseUpdateOptionDto {
  @IsOptional()
  @IsBoolean()
  isConnected?: boolean;
}

export class CreateNextActionDto extends BaseOptionDto {
  @Matches(CODE_RULE, { message: CODE_MESSAGE })
  code: string;

  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;
}

export class UpdateNextActionDto extends BaseUpdateOptionDto {
  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;
}

export class UpdateRequiredFieldsDto {
  @IsIn(REQUIRED_RULES)
  userResponse: RequiredRule;

  @IsIn(REQUIRED_RULES)
  notes: RequiredRule;

  @IsIn(REQUIRED_RULES)
  interestRating: RequiredRule;
}

export class UpdateFollowUpTimingDto {
  @IsInt()
  @Min(0)
  @Max(1440)
  reminderMinutesBefore: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  gracePeriodMinutes: number;

  @IsInt()
  @Min(1)
  @Max(120)
  presenceTimeoutMinutes: number;
}

export class UpdateCallingWorkflowDto {
  @IsInt()
  @Min(1)
  @Max(480)
  incompleteFormMinutes: number;

  @IsInt()
  @Min(0) // 0 = auto-release band
  @Max(1440)
  autoReleaseMinutes: number;
}
