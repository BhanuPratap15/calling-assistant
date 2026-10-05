import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service.js';
import { Public } from './auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /api/health — server zinda hai ya nahi (monitoring/load balancer ke liye)
  @Public()
  @Get('health')
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const health = await this.appService.getHealth();
    // DB down → 503: load balancer / Docker / uptime monitor turant "unhealthy" samjhe
    if (health.database !== 'up') res.status(503);
    return health;
  }
}
