import {
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { TelephonyService } from './telephony.service.js';

@Controller('telephony')
export class TelephonyController {
  constructor(private readonly telephony: TelephonyService) {}

  /** UI: kaunsa provider chal raha hai (button ka text / behaviour) — koi bhi logged-in user */
  @Get('config')
  config() {
    return this.telephony.info();
  }

  /**
   * Provider → CRM call events. Login nahi (provider ke paas token nahi hota) —
   * isliye @Public, aur security = HMAC signature + timestamp (provider ke parser me check).
   */
  @Public()
  @Post('webhooks/:provider')
  @HttpCode(200)
  webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!req.rawBody) {
      // main.ts me NestFactory.create(..., { rawBody: true }) zaroori hai
      throw new InternalServerErrorException('Raw body not available');
    }
    return this.telephony.handleWebhook(provider, {
      headers: req.headers,
      rawBody: req.rawBody,
      body: req.body as unknown,
    });
  }
}
