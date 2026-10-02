import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto.js';

// PartialType = CreateCustomerDto ke saare fields, par sab optional (PATCH me sirf badla hua field bhejo)
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
