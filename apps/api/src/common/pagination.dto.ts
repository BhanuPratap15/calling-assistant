import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * List APIs ke liye common query: ?page=2&pageSize=50
 * 20,000 customers ek saath nahi bhejte — "pages" me bhejte hain.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number) // URL query hamesha string hoti hai → number me badlo
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
