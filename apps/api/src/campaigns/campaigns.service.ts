import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { diffChanges } from '../audit/diff.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Paginated } from '../common/pagination.dto.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canTransition, validateFieldDefinitions } from './campaign-rules.js';
import type {
  AddCustomersDto,
  CreateCampaignDto,
  CustomerFilterDto,
  ListCampaignCustomersQueryDto,
  ListCampaignsQueryDto,
  SaveFieldsDto,
  SetMembersDto,
  UpdateCampaignDto,
} from './dto/campaign.dto.js';

const DUPLICATE = 'A campaign with this name already exists';
const FIELD_ORDER = [{ sortOrder: 'asc' as const }, { label: 'asc' as const }];

export interface CampaignStats {
  total: number;
  called: number;
  pending: number;
  byOutcome: { label: string; isConnected: boolean; count: number }[];
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------- read ----------------

  async findAll(query: ListCampaignsQueryDto) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { status: query.status },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { customers: true, staff: true, teams: true } },
      },
    });
    // Called count ek query me (har campaign ke liye alag query nahi — "N+1" se bachav)
    const called = await this.prisma.campaignCustomer.groupBy({
      by: ['campaignId'],
      where: { callCount: { gt: 0 } },
      _count: { _all: true },
    });
    return campaigns.map((c) => ({
      ...c,
      progress: {
        total: c._count.customers,
        called: called.find((g) => g.campaignId === c.id)?._count._all ?? 0,
      },
    }));
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        staff: {
          select: { staff: { select: { id: true, name: true, role: true } } },
        },
        teams: { select: { team: { select: { id: true, name: true } } } },
        fields: { orderBy: FIELD_ORDER },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return { ...campaign, stats: await this.stats(id) };
  }

  /** Progress + outcome-wise counts (design doc section 15: "Campaign performance") */
  async stats(campaignId: string): Promise<CampaignStats> {
    const [total, called, outcomes] = await Promise.all([
      this.prisma.campaignCustomer.count({ where: { campaignId } }),
      this.prisma.campaignCustomer.count({
        where: { campaignId, callCount: { gt: 0 } },
      }),
      this.prisma.call.groupBy({
        by: ['outcomeId'],
        where: { campaignId },
        _count: { _all: true },
      }),
    ]);
    const outcomeRows = await this.prisma.callOutcome.findMany({
      where: { id: { in: outcomes.map((o) => o.outcomeId) } },
    });
    return {
      total,
      called,
      pending: total - called,
      byOutcome: outcomes
        .map((o) => {
          const row = outcomeRows.find((r) => r.id === o.outcomeId);
          return {
            label: row?.label ?? '?',
            isConnected: row?.isConnected ?? false,
            count: o._count._all,
          };
        })
        .sort((a, b) => b.count - a.count),
    };
  }

  async listCustomers(id: string, query: ListCampaignCustomersQueryDto) {
    await this.ensureExists(id);
    const where: Prisma.CampaignCustomerWhereInput = {
      campaignId: id,
      callCount:
        query.state === 'pending'
          ? 0
          : query.state === 'called'
            ? { gt: 0 }
            : undefined,
      customer: query.search?.trim()
        ? { name: { contains: query.search.trim(), mode: 'insensitive' } }
        : undefined,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.campaignCustomer.findMany({
        where,
        orderBy: [{ callCount: 'asc' }, { addedAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          callCount: true,
          lastCalledAt: true,
          addedAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              status: true,
              priority: true,
              interestRating: true,
              category: {
                select: { id: true, code: true, label: true, color: true },
              },
            },
          },
        },
      }),
      this.prisma.campaignCustomer.count({ where }),
    ]);
    const result: Paginated<(typeof data)[number]> = {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
    return result;
  }

  // ---------------- write ----------------

  create(dto: CreateCampaignDto, actor: AuthUser) {
    this.assertDates(dto.startsAt, dto.endsAt);
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const campaign = await tx.campaign.create({
            data: { ...dto, name: dto.name.trim(), createdById: actor.id },
          });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.CAMPAIGN_CREATED,
              entityType: 'campaign',
              entityId: campaign.id,
              metadata: { name: campaign.name },
            },
            tx,
          );
          return campaign;
        }),
      DUPLICATE,
    );
  }

  async update(id: string, dto: UpdateCampaignDto, actor: AuthUser) {
    const before = await this.ensureExists(id);
    if (dto.status && !canTransition(before.status, dto.status)) {
      throw new BadRequestException(
        `Cannot change status from ${before.status} to ${dto.status}`,
      );
    }
    this.assertDates(
      dto.startsAt === undefined ? before.startsAt : dto.startsAt,
      dto.endsAt === undefined ? before.endsAt : dto.endsAt,
    );
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const after = await tx.campaign.update({
            where: { id },
            data: { ...dto, name: dto.name?.trim() },
          });
          const changes = diffChanges(before, after, [
            'name',
            'description',
            'status',
            'priority',
            'script',
            'startsAt',
            'endsAt',
          ]);
          if (changes) {
            await this.audit.record(
              {
                actorId: actor.id,
                action: AuditAction.CAMPAIGN_UPDATED,
                entityType: 'campaign',
                entityId: id,
                changes,
              },
              tx,
            );
          }
          return after;
        }),
      DUPLICATE,
    );
  }

  async setMembers(id: string, dto: SetMembersDto, actor: AuthUser) {
    await this.ensureExists(id);
    const staffIds = [...new Set(dto.staffIds)];
    const teamIds = [...new Set(dto.teamIds)];
    const [staff, teams] = await Promise.all([
      this.prisma.staff.findMany({
        where: {
          id: { in: staffIds },
          isActive: true,
          role: { in: ['ASSISTANT', 'TEAM_LEADER'] },
        },
        select: { id: true, name: true },
      }),
      this.prisma.team.findMany({
        where: { id: { in: teamIds }, isActive: true },
        select: { id: true, name: true },
      }),
    ]);
    if (staff.length !== staffIds.length) {
      throw new BadRequestException(
        'staffIds must be active ASSISTANT / TEAM_LEADER',
      );
    }
    if (teams.length !== teamIds.length)
      throw new BadRequestException('teamIds must be active teams');

    await this.prisma.$transaction(async (tx) => {
      await tx.campaignStaff.deleteMany({ where: { campaignId: id } });
      await tx.campaignTeam.deleteMany({ where: { campaignId: id } });
      await tx.campaignStaff.createMany({
        data: staffIds.map((staffId) => ({ campaignId: id, staffId })),
      });
      await tx.campaignTeam.createMany({
        data: teamIds.map((teamId) => ({ campaignId: id, teamId })),
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CAMPAIGN_MEMBERS_UPDATED,
          entityType: 'campaign',
          entityId: id,
          metadata: {
            staff: staff.map((s) => s.name),
            teams: teams.map((t) => t.name),
          },
        },
        tx,
      );
    });
    return this.findOne(id);
  }

  /** IDs se ya filter se. Duplicate (pehle se campaign me) skip. Sirf ACTIVE customers. */
  async addCustomers(id: string, dto: AddCustomersDto, actor: AuthUser) {
    const campaign = await this.ensureExists(id);
    if (campaign.status === 'COMPLETED')
      throw new BadRequestException('Campaign is completed');
    if (!dto.customerIds?.length && !dto.filter) {
      throw new BadRequestException('Provide customerIds or a filter');
    }

    const where: Prisma.CustomerWhereInput = {
      status: 'ACTIVE',
      ...(dto.customerIds?.length
        ? { id: { in: dto.customerIds } }
        : this.filterWhere(dto.filter!)),
    };
    const customers = await this.prisma.customer.findMany({
      where,
      select: { id: true },
      take: 50_000,
    });

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.campaignCustomer.createMany({
        data: customers.map((c) => ({
          campaignId: id,
          customerId: c.id,
          addedById: actor.id,
        })),
        skipDuplicates: true, // pehle se hai to chhod do (composite primary key)
      });
      // Naye customers aaye → "campaign khatam" alert dobara bhej sakein (ADR 0015)
      if (count)
        await tx.campaign.update({
          where: { id },
          data: { exhaustedNotifiedAt: null },
        });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CAMPAIGN_CUSTOMERS_ADDED,
          entityType: 'campaign',
          entityId: id,
          metadata: {
            added: count,
            matched: customers.length,
            via: dto.customerIds?.length ? 'ids' : 'filter',
            filter: (dto.filter ?? null) as Record<string, unknown> | null,
          },
        },
        tx,
      );
      return {
        matched: customers.length,
        added: count,
        skipped: customers.length - count,
      };
    });
  }

  async removeCustomers(id: string, customerIds: string[], actor: AuthUser) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.campaignCustomer.deleteMany({
        where: { campaignId: id, customerId: { in: customerIds } },
      });
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CAMPAIGN_CUSTOMERS_REMOVED,
          entityType: 'campaign',
          entityId: id,
          metadata: { removed: count },
        },
        tx,
      );
      return { removed: count };
    });
  }

  /** Custom fields poora set (keys permanent — purani calls ka data isi key se) */
  async saveFields(id: string, dto: SaveFieldsDto, actor: AuthUser) {
    await this.ensureExists(id);
    const existing = await this.prisma.campaignField.findMany({
      where: { campaignId: id },
    });
    const byId = new Map(existing.map((f) => [f.id, f]));
    for (const f of dto.fields) {
      if (f.id) {
        const old = byId.get(f.id);
        if (!old)
          throw new BadRequestException(
            `Field ${f.id} not found in this campaign`,
          );
        if (old.key !== f.key)
          throw new BadRequestException(`Field key cannot change (${old.key})`);
        if (old.type !== f.type)
          throw new BadRequestException(
            `Field type cannot change (${old.key})`,
          );
      }
    }
    const sentIds = new Set(dto.fields.map((f) => f.id).filter(Boolean));
    const finalSet = [
      ...existing.filter((f) => !sentIds.has(f.id)),
      ...dto.fields.map((f) => ({
        ...f,
        options: f.options.map((o) => o.trim()).filter(Boolean),
      })),
    ];
    const errors = validateFieldDefinitions(finalSet);
    if (errors.length) throw new BadRequestException(errors);

    return this.prisma.$transaction(async (tx) => {
      for (const f of dto.fields) {
        const data = {
          label: f.label.trim(),
          options: f.options.map((o) => o.trim()).filter(Boolean),
          required: f.required,
          isActive: f.isActive,
          sortOrder: f.sortOrder,
        };
        if (f.id) await tx.campaignField.update({ where: { id: f.id }, data });
        else
          await tx.campaignField.create({
            data: { ...data, campaignId: id, key: f.key, type: f.type },
          });
      }
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CAMPAIGN_FIELDS_UPDATED,
          entityType: 'campaign',
          entityId: id,
          metadata: {
            fields: dto.fields.map(
              (f) =>
                `${f.key}:${f.type}${f.required ? '*' : ''}${f.isActive ? '' : '(off)'}`,
            ),
          },
        },
        tx,
      );
      return tx.campaignField.findMany({
        where: { campaignId: id },
        orderBy: FIELD_ORDER,
      });
    });
  }

  // ---------------- helpers ----------------

  private async ensureExists(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private assertDates(startsAt?: Date | null, endsAt?: Date | null) {
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
  }

  private filterWhere(filter: CustomerFilterDto): Prisma.CustomerWhereInput {
    const term = filter.search?.trim();
    return {
      categoryId: filter.categoryId === 'none' ? null : filter.categoryId,
      tags: filter.tagId ? { some: { tagId: filter.tagId } } : undefined,
      priority: filter.priority,
      lastCalledAt: filter.neverCalled ? null : undefined,
      name: term ? { contains: term, mode: 'insensitive' } : undefined,
    };
  }
}
