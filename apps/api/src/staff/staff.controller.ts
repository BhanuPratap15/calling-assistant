import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { StaffService } from './staff.service.js';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  // GET /api/staff — sirf Manager (aur Super Admin) dekh sakte hain
  @Roles('MANAGER')
  @Get()
  findAll() {
    return this.staffService.findAll();
  }
}
