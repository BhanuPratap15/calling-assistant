import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';

/**
 * bucket (design doc section 14 dashboard jaisa):
 *   upcoming  → abhi time nahi aaya
 *   due       → time ho gaya, grace period ke andar
 *   overdue   → grace period bhi nikal gaya
 *   open      → upcoming + due + overdue
 *   completed / cancelled
 */
export const FOLLOW_UP_BUCKETS = [
  'open',
  'upcoming',
  'due',
  'overdue',
  'completed',
  'cancelled',
] as const;
export type FollowUpBucket = (typeof FOLLOW_UP_BUCKETS)[number];

export class ListFollowUpsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(FOLLOW_UP_BUCKETS)
  bucket: FollowUpBucket = 'open';

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class RescheduleFollowUpDto {
  @Type(() => Date)
  @IsDate()
  dueAt: Date;
}

export class ReassignFollowUpDto {
  @IsUUID()
  staffId: string;
}
