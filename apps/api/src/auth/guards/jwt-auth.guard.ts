import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedRequest, JwtPayload } from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard = darwaaze ka guard. Har request pe chalta hai (global, app.module me register).
 * 1. @Public() route → seedha jaane do
 * 2. Header "Authorization: Bearer <token>" se token nikalo + verify karo
 * 3. DB se staff check karo (deactivate hua staff turant block ho jaaye)
 * 4. request.user set karo
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing access token');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!staff || !staff.isActive) {
      throw new UnauthorizedException('Account not found or deactivated');
    }

    request.user = {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role, // role hamesha DB se — token purana ho tab bhi latest role
    };
    return true;
  }

  private extractBearerToken(
    request: AuthenticatedRequest,
  ): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
