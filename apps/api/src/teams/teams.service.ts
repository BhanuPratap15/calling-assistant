import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTeamDto) {
    if (dto.leaderId) await this.assertValidLeader(dto.leaderId);
    return withUniqueConflict(
      () =>
        this.prisma.team.create({
          data: {
            name: dto.name.trim(),
            description: dto.description,
            leaderId: dto.leaderId,
          },
          select: teamListSelect,
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

  async update(id: string, dto: UpdateTeamDto) {
    const exists = await this.prisma.team.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Team not found');
    if (dto.leaderId) await this.assertValidLeader(dto.leaderId);

    return withUniqueConflict(
      () =>
        this.prisma.team.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            description: dto.description,
            leaderId: dto.leaderId, // null = leader hatao
            isActive: dto.isActive,
          },
          select: teamListSelect,
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
