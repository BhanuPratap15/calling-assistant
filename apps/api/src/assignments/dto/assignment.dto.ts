import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import {
  DISTRIBUTION_STRATEGIES,
  type DistributionStrategy,
} from '../distribution.js';

/** Ek distribute run me max customers (ek transaction; 20k ke liye 10 run) */
export const MAX_DISTRIBUTE = 2000;
const CUSTOMER_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class CreateAssignmentDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  staffId: string; // kisko dena hai (ASSISTANT / TEAM_LEADER)

  // Optional: kis campaign ke liye (customer us campaign me hona chahiye) — call usi me count hogi
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export class ReassignDto {
  @IsUUID()
  staffId: string;
}

// GET /api/assignments?status=open&staffId=...
export class ListAssignmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['open', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status: string = 'open'; // open = ASSIGNED + IN_PROGRESS

  @IsOptional()
  @IsUUID()
  staffId?: string;
}

/**
 * POST /api/assignments/distribute — bulk round-robin / load-based (ADR 0015).
 * dryRun=true → sirf preview (kisko kitne), kuch save nahi.
 */
export class DistributeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  staffIds: string[];

  @IsIn(DISTRIBUTION_STRATEGIES)
  strategy: DistributionStrategy;

  @IsInt()
  @Min(1)
  @Max(MAX_DISTRIBUTE)
  limit: number; // total kitne customers baantne hain

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_DISTRIBUTE)
  perStaffLimit?: number;

  // ---- kaunse customers (sab optional; ACTIVE + kisi ke paas nahi + open follow-up nahi hamesha) ----
  @IsOptional()
  @IsUUID()
  campaignId?: string; // diya → is campaign ke abhi tak na call hue customers (call campaign me count)

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  tagId?: string;

  @IsOptional()
  @IsIn(CUSTOMER_PRIORITIES)
  priority?: (typeof CUSTOMER_PRIORITIES)[number];

  @IsOptional()
  @IsBoolean()
  onlyFresh: boolean = true; // kabhi call nahi hue (campaign ke bina)

  @IsOptional()
  @IsBoolean()
  dryRun: boolean = false;
}
