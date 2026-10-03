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
import { withUniqueConflict } from '../common/prisma-errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { UpdateTeamDto } from './dto/update-team.dto.js';

const leaderSelect = { select: { id: true, name: true, email: true } };

const teamListSelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  leader: leaderSelect,
  _count: { select: { members: true } }, // kitne members — bina saare members laaye
  createdAt: true,
} satisfies Prisma.TeamSelect;

const teamDetailSelect = {
  ...teamListSelect,
  members: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      availability: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  },
} satisfies Prisma.TeamSelect;

const DUPLICATE_MESSAGE = 'A team with this name already exists';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateTeamDto, actor: AuthUser) {
    if (dto.leaderId) await this.assertValidLeader(dto.leaderId);
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const team = await tx.team.create({
            data: {
              name: dto.name.trim(),
              description: dto.description,
              leaderId: dto.leaderId,
            },
            select: teamListSelect,
          });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.TEAM_CREATED,
              entityType: 'team',
              entityId: team.id,
              metadata: { name: team.name, leaderId: team.leader?.id ?? null },
            },
            tx,
          );
          return team;
        }),
      DUPLICATE_MESSAGE,
    );
  }

  /** Manager ko saari teams; Team Leader ko sirf wo jinke wo leader hain */
  findAll(actor: AuthUser) {
    return this.prisma.team.findMany({
      where: actor.role === 'TEAM_LEADER' ? { leaderId: actor.id } : undefined,
      select: teamListSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, actor: AuthUser) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      select: teamDetailSelect,
    });
    if (!team) throw new NotFoundException('Team not found');
    if (actor.role === 'TEAM_LEADER' && team.leader?.id !== actor.id) {
      throw new ForbiddenException('You can only view teams you lead');
    }
    return team;
  }

  async update(id: string, dto: UpdateTeamDto, actor: AuthUser) {
    const before = await this.prisma.team.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Team not found');
    if (dto.leaderId) await this.assertValidLeader(dto.leaderId);

    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const after = await tx.team.update({
            where: { id },
            data: {
              name: dto.name?.trim(),
              description: dto.description,
              leaderId: dto.leaderId, // null = leader hatao
              isActive: dto.isActive,
            },
          });
          const changes = diffChanges(before, after, [
            'name',
            'description',
            'leaderId',
            'isActive',
          ]);
          if (changes) {
            await this.audit.record(
              {
                actorId: actor.id,
                action: AuditAction.TEAM_UPDATED,
                entityType: 'team',
                entityId: id,
                changes,
              },
              tx,
            );
          }
          return tx.team.findUniqueOrThrow({
            where: { id },
            select: teamListSelect,
          });
        }),
      DUPLICATE_MESSAGE,
    );
  }

  private async assertValidLeader(staffId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
    });
    if (!staff || !staff.isActive || staff.role !== 'TEAM_LEADER') {
      throw new BadRequestException('leaderId must be an active TEAM_LEADER');
    }
  }
}
