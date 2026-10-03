import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AUTH_COOKIE, type AuthUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';

/**
 * Cookie settings:
 *  httpOnly  → browser ki JavaScript cookie padh nahi sakti (XSS se token chori nahi)
 *  sameSite  → doosri website se aayi request ke saath cookie nahi jaati (CSRF se bachav)
 *  secure    → production me sirf HTTPS pe
 */
const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/auth/login  { email, password }  →  { accessToken, expiresAt, user }
  // + httpOnly cookie set hoti hai (browser ke liye). API tools body wala accessToken use karein.
  @Public()
  @Post('login')
  @HttpCode(200) // POST ka default 201 (Created) hota hai; login kuch "create" nahi karta
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response, // passthrough: return value normal JSON hi rahe
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    res.cookie(AUTH_COOKIE, result.accessToken, {
      ...cookieOptions(),
      expires: new Date(result.expiresAt),
    });
    return result;
  }

  // POST /api/auth/logout → cookie hata do. Public: token expire ho gaya ho tab bhi logout chal jaaye.
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    const cookie = (req.cookies as Record<string, string> | undefined)?.[
      AUTH_COOKIE
    ];
    await this.authService.markOfflineFromToken(bearer ?? cookie); // availability → OFFLINE
    res.clearCookie(AUTH_COOKIE, cookieOptions());
  }

  // GET /api/auth/me  (header: Authorization: Bearer <token>)  →  logged-in staff
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user);
  }

  // PATCH /api/auth/availability { availability: AVAILABLE | BREAK | OFFLINE }
  @Patch('availability')
  setAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.authService.setAvailability(user.id, dto.availability);
  }

  // POST /api/auth/change-password  { currentPassword, newPassword }  →  204
  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
