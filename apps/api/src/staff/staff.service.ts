import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { diffChanges } from '../audit/diff.js';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateStaffDto, actor: AuthUser) {
    this.assertCanManage(actor, dto.role);
    if (dto.teamId) await this.assertActiveTeam(dto.teamId);
    const passwordHash = await hashPassword(dto.password);

    return withUniqueConflict(
      () =>
        // Interactive transaction: staff create + audit — dono ya koi nahi
        this.prisma.$transaction(async (tx) => {
          const staff = await tx.staff.create({
            data: {
              name: dto.name.trim(),
              email: dto.email.trim().toLowerCase(),
              phone: dto.phone,
              role: dto.role,
              teamId: dto.teamId,
              passwordHash,
            },
            select: staffPublicSelect,
          });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.STAFF_CREATED,
              entityType: 'staff',
              entityId: staff.id,
              metadata: {
                name: staff.name,
                email: staff.email,
                role: staff.role,
                teamId: staff.teamId,
              },
            },
            tx,
          );
          return staff;
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

    // TEAM_LEADER nahi raha (role badla ya deactivate hua) → uski teams se leader hatao.
    const leavesLeaderRole =
      target.role === 'TEAM_LEADER' &&
      ((dto.role !== undefined && dto.role !== 'TEAM_LEADER') ||
        dto.isActive === false);

    // Update + (zaroorat ho to) teams se leader hatao + audit — sab ek transaction me
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
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

      const clearedTeams = leavesLeaderRole
        ? (
            await tx.team.updateMany({
              where: { leaderId: id },
              data: { leaderId: null },
            })
          ).count
        : 0;

      const changes = diffChanges(target, updated, [
        'name',
        'phone',
        'role',
        'teamId',
        'isActive',
      ]);
      if (changes) {
        await this.audit.record(
          {
            actorId: actor.id,
            action: AuditAction.STAFF_UPDATED,
            entityType: 'staff',
            entityId: id,
            changes,
            metadata: clearedTeams
              ? { removedAsLeaderOfTeams: clearedTeams }
              : undefined,
          },
          tx,
        );
      }
      return updated;
    });
  }

  async resetPassword(id: string, newPassword: string, actor: AuthUser) {
    const target = await this.findOne(id);
    this.assertCanManage(actor, target.role);
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({ where: { id }, data: { passwordHash } });
      // Password ki value KABHI log nahi hoti — sirf "reset hua" ka record
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.STAFF_PASSWORD_RESET,
          entityType: 'staff',
          entityId: id,
        },
        tx,
      );
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
