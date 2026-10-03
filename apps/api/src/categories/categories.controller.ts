import { Body, Controller, Get, Put } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CategoriesService } from './categories.service.js';
import { SaveCategoriesDto } from './dto/category.dto.js';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  // Sab (filters / badges ke liye)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Dashboard: category-wise customer counts
  @Roles('MANAGER', 'TEAM_LEADER')
  @Get('summary')
  summary() {
    return this.service.summary();
  }

  // Thresholds save + saare customers recalculate
  @Roles('MANAGER')
  @Put()
  save(@Body() dto: SaveCategoriesDto, @CurrentUser() user: AuthUser) {
    return this.service.save(dto, user);
  }
}
