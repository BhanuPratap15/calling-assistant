import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /api/health — server zinda hai ya nahi (monitoring/load balancer ke liye)
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
