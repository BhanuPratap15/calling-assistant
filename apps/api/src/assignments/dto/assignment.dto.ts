import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';

export class CreateAssignmentDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  staffId: string; // kisko dena hai (ASSISTANT / TEAM_LEADER)
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
