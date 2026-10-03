import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CustomersService } from './customers.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';

/**
 * Customers = jinko call kiya jaata hai.
 * Abhi: Manager create/update; Manager + Team Leader dekh sakte hain.
 * Assistants ko customer assignment ke through milega (Phase 2) — poori list nahi.
 * Delete nahi hai: status = DO_NOT_CALL / INVALID karo (history bachi rahe).
 */
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles('MANAGER')
  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.create(dto, user.id);
  }

  @Roles('MANAGER', 'TEAM_LEADER')
  @Get()
  findAll(@Query() query: ListCustomersQueryDto) {
    return this.customersService.findAll(query);
  }

  // ParseUUIDPipe: galat id format ("abc") → 400, DB tak jaane se pehle
  @Roles('MANAGER', 'TEAM_LEADER')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Roles('MANAGER')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.update(id, dto, user.id);
  }
}
