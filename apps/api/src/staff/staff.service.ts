import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { hashPassword } from '../auth/password.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import type { StaffRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateStaffDto } from './dto/create-staff.dto.js';
import type { ListStaffQueryDto } from './dto/list-staff-query.dto.js';
import type { UpdateStaffDto } from './dto/update-staff.dto.js';
import { canManageRole } from './staff-permissions.js';
import { staffPublicSelect } from './staff.select.js';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffDto, actor: AuthUser) {
    this.assertCanManage(actor, dto.role);
    if (dto.teamId) await this.assertActiveTeam(dto.teamId);
    const passwordHash = await hashPassword(dto.password);

    return withUniqueConflict(
      () =>
        this.prisma.staff.create({
          data: {
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            phone: dto.phone,
            role: dto.role,
            teamId: dto.teamId,
            passwordHash,
          },
          select: staffPublicSelect,
        }),
      'A staff member with this email already exists',
    );
  }

  findAll(query: ListStaffQueryDto) {
    return this.prisma.staff.findMany({
      where: {
        role: query.role,
        teamId: query.teamId,
        isActive: query.isActive,
      },
      select: staffPublicSelect,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      select: staffPublicSelect,
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async update(id: string, dto: UpdateStaffDto, actor: AuthUser) {
    const target = await this.findOne(id);
    this.assertCanManage(actor, target.role); // jo abhi hai usko manage kar sakte ho?
    if (dto.role) this.assertCanManage(actor, dto.role); // aur jo bana rahe ho usko?

    // Lockout se bachav: koi apna khud ka role ya active status nahi badal sakta
    if (
      id === actor.id &&
      (dto.role !== undefined || dto.isActive !== undefined)
    ) {
      throw new BadRequestException(
        'You cannot change your own role or active status',
      );
    }
    if (dto.teamId) await this.assertActiveTeam(dto.teamId);

    const updateStaff = this.prisma.staff.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone,
        role: dto.role,
        teamId: dto.teamId, // null = team se hatao
        isActive: dto.isActive,
      },
      select: staffPublicSelect,
    });

    // TEAM_LEADER nahi raha (role badla ya deactivate hua) → uski teams se leader hatao.
    // Dono kaam ek transaction me: ya dono honge ya koi nahi.
    const leavesLeaderRole =
      target.role === 'TEAM_LEADER' &&
      ((dto.role !== undefined && dto.role !== 'TEAM_LEADER') ||
        dto.isActive === false);
    if (!leavesLeaderRole) return updateStaff;

    const [updated] = await this.prisma.$transaction([
      updateStaff,
      this.prisma.team.updateMany({
        where: { leaderId: id },
        data: { leaderId: null },
      }),
    ]);
    return updated;
  }

  async resetPassword(id: string, newPassword: string, actor: AuthUser) {
    const target = await this.findOne(id);
    this.assertCanManage(actor, target.role);
    await this.prisma.staff.update({
      where: { id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  }

  // ---- helpers ----

  private assertCanManage(actor: AuthUser, targetRole: StaffRole) {
    if (!canManageRole(actor.role, targetRole)) {
      throw new ForbiddenException(
        `${actor.role} cannot manage staff with role ${targetRole}`,
      );
    }
  }

  private async assertActiveTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team || !team.isActive) {
      throw new BadRequestException('teamId does not belong to an active team');
    }
  }
}
