import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /api/auth/login  { email, password }  →  { accessToken, user }
  @Public()
  @Post('login')
  @HttpCode(200) // POST ka default 201 (Created) hota hai; login kuch "create" nahi karta
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // GET /api/auth/me  (header: Authorization: Bearer <token>)  →  logged-in staff
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
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
