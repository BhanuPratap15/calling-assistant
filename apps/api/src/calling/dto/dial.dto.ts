import { IsIn, IsOptional } from 'class-validator';

export class DialDto {
  // primary = customer.phone, alternate = customer.alternatePhone
  @IsOptional()
  @IsIn(['primary', 'alternate'])
  number?: 'primary' | 'alternate';
}
