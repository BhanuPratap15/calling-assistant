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
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTagDto, UpdateTagDto } from './dto/tag.dto.js';

const DUPLICATE = 'A tag with this name already exists';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { customers: true } } }, // kitne customers pe laga hai
    });
  }

  create(dto: CreateTagDto, actor: AuthUser) {
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const tag = await tx.tag.create({
            data: { name: dto.name.trim(), color: dto.color },
          });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.TAG_CREATED,
              entityType: 'tag',
              entityId: tag.id,
              metadata: { name: tag.name },
            },
            tx,
          );
          return tag;
        }),
      DUPLICATE,
    );
  }

  async update(id: string, dto: UpdateTagDto, actor: AuthUser) {
    const before = await this.prisma.tag.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Tag not found');
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const after = await tx.tag.update({
            where: { id },
            data: {
              name: dto.name?.trim(),
              color: dto.color,
              isActive: dto.isActive,
            },
          });
          const changes = diffChanges(before, after, [
            'name',
            'color',
            'isActive',
          ]);
          if (changes) {
            await this.audit.record(
              {
                actorId: actor.id,
                action: AuditAction.TAG_UPDATED,
                entityType: 'tag',
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

  /**
   * Customer ke tags replace. Manager/TL: koi bhi customer.
   * Assistant: sirf jo customer abhi uske paas hai (calling screen se tag lagana).
   */
  async setCustomerTags(customerId: string, tagIds: string[], actor: AuthUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        tags: { include: { tag: true } },
        assignments: {
          where: { openCustomerId: { not: null } },
          select: { staffId: true },
        },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (
      actor.role === 'ASSISTANT' &&
      !customer.assignments.some((a) => a.staffId === actor.id)
    ) {
      throw new ForbiddenException('This customer is not assigned to you');
    }

    const unique = [...new Set(tagIds)];
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: unique } },
    });
    const currentIds = new Set(customer.tags.map((t) => t.tagId));
    // Naye tags active hone chahiye; pehle se lage (ab inactive) tags rakh sakte hain
    const invalid = unique.filter((id) => {
      const tag = tags.find((t) => t.id === id);
      return !tag || (!tag.isActive && !currentIds.has(id));
    });
    if (invalid.length)
      throw new BadRequestException(
        `Invalid or inactive tag ids: ${invalid.join(', ')}`,
      );

    const toAdd = unique.filter((id) => !currentIds.has(id));
    const toRemove = [...currentIds].filter((id) => !unique.includes(id));
    if (!toAdd.length && !toRemove.length) return tags;

    await this.prisma.$transaction(async (tx) => {
      await tx.customerTag.deleteMany({
        where: { customerId, tagId: { in: toRemove } },
      });
      await tx.customerTag.createMany({
        data: toAdd.map((tagId) => ({
          customerId,
          tagId,
          addedById: actor.id,
        })),
      });
      const name = (id: string) =>
        tags.find((t) => t.id === id)?.name ??
        customer.tags.find((t) => t.tagId === id)?.tag.name ??
        id;
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CUSTOMER_TAGS_UPDATED,
          entityType: 'customer',
          entityId: customerId,
          changes: {
            tags: {
              from: customer.tags.map((t) => t.tag.name).sort(),
              to: unique.map(name).sort(),
            },
          },
        },
        tx,
      );
    });
    return tags;
  }
}
