import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /api/health — server zinda hai ya nahi (monitoring/load balancer ke liye)
  @Public()
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
