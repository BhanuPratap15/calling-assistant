import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { categoryForRating, validateCategoryRanges } from './category-rules.js';
import type { SaveCategoriesDto } from './dto/category.dto.js';

type Tx = Prisma.TransactionClient;
const ORDER = [{ sortOrder: 'asc' as const }, { minRating: 'asc' as const }];

/**
 * CATEGORY ENGINE (design doc section 10).
 *  - applyRating(): call save pe (Save & Next transaction ke andar) → latest rating + category + history
 *  - save():        Manager thresholds badle → validate → saare customers recalculate (ek SQL)
 */
@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: ORDER });
  }

  /** Dashboard: har category me kitne customers (+ bina category) */
  async summary() {
    const [categories, grouped] = await Promise.all([
      this.prisma.category.findMany({ orderBy: ORDER }),
      this.prisma.customer.groupBy({
        by: ['categoryId'],
        _count: { _all: true },
      }),
    ]);
    const count = (id: string | null) =>
      grouped.find((g) => g.categoryId === id)?._count._all ?? 0;
    return {
      categories: categories
        .filter((c) => c.isActive || count(c.id) > 0)
        .map((c) => ({
          id: c.id,
          code: c.code,
          label: c.label,
          color: c.color,
          count: count(c.id),
        })),
      uncategorized: count(null),
    };
  }

  /** Call me rating aayi → customer update (+ category badli to history, priority, audit) */
  async applyRating(
    tx: Tx,
    args: {
      customerId: string;
      rating: number;
      callId: string;
      actorId: string;
    },
  ) {
    const [customer, categories] = await Promise.all([
      tx.customer.findUniqueOrThrow({
        where: { id: args.customerId },
        select: { categoryId: true, priority: true },
      }),
      tx.category.findMany({ where: { isActive: true } }),
    ]);
    const target = categoryForRating(args.rating, categories);
    const changed = (target?.id ?? null) !== customer.categoryId;

    await tx.customer.update({
      where: { id: args.customerId },
      data: {
        interestRating: args.rating,
        ...(changed && {
          categoryId: target?.id ?? null,
          categoryUpdatedAt: new Date(),
          ...(target?.priority && { priority: target.priority }), // VIP → URGENT (priority-aware assignment)
        }),
      },
    });
    if (!changed) return;

    await tx.customerCategoryChange.create({
      data: {
        customerId: args.customerId,
        fromId: customer.categoryId,
        toId: target?.id ?? null,
        rating: args.rating,
        reason: 'call_rating',
        callId: args.callId,
        changedById: args.actorId,
      },
    });
    await this.audit.record(
      {
        actorId: args.actorId,
        action: AuditAction.CUSTOMER_CATEGORY_CHANGED,
        entityType: 'customer',
        entityId: args.customerId,
        changes: {
          categoryId: { from: customer.categoryId, to: target?.id ?? null },
          ...(target?.priority && target.priority !== customer.priority
            ? { priority: { from: customer.priority, to: target.priority } }
            : {}),
        },
        metadata: {
          rating: args.rating,
          category: target?.code ?? null,
          callId: args.callId,
        },
      },
      tx,
    );
  }

  /**
   * Thresholds save (poora set ek saath).
   * Doc: "admin can change 8+ to 7+ without rewriting the application" → existing customers bhi recalculate.
   */
  async save(dto: SaveCategoriesDto, actor: AuthUser) {
    const existing = await this.prisma.category.findMany();
    const byId = new Map(existing.map((c) => [c.id, c]));

    for (const c of dto.categories) {
      if (c.id) {
        const old = byId.get(c.id);
        if (!old) throw new BadRequestException(`Category ${c.id} not found`);
        if (old.code !== c.code)
          throw new BadRequestException(
            `Category code cannot change (${old.code})`,
          );
      }
    }
    // Payload me na ho wo categories bhi (unchanged) validation me shamil — overlap poore set pe
    const sentIds = new Set(dto.categories.map((c) => c.id).filter(Boolean));
    const finalSet = [
      ...existing.filter((c) => !sentIds.has(c.id)),
      ...dto.categories,
    ];
    const { errors, uncovered } = validateCategoryRanges(finalSet);
    if (errors.length) throw new BadRequestException(errors);

    return this.prisma.$transaction(async (tx) => {
      for (const c of dto.categories) {
        const data = {
          label: c.label.trim(),
          minRating: c.minRating,
          maxRating: c.maxRating,
          color: c.color,
          priority: c.priority,
          isActive: c.isActive,
          sortOrder: c.sortOrder,
        };
        if (c.id) await tx.category.update({ where: { id: c.id }, data });
        else await tx.category.create({ data: { ...data, code: c.code } });
      }
      const recalculated = await this.recalculateAll(tx, actor.id);
      await this.audit.record(
        {
          actorId: actor.id,
          action: AuditAction.CATEGORIES_UPDATED,
          entityType: 'category',
          entityId: null,
          metadata: {
            ranges: dto.categories.map(
              (c) =>
                `${c.code}:${c.minRating}-${c.maxRating}${c.isActive ? '' : '(off)'}`,
            ),
            recalculated,
          },
        },
        tx,
      );
      return {
        categories: await tx.category.findMany({ orderBy: ORDER }),
        recalculated,
        uncovered,
      };
    });
  }

  /**
   * SET-BASED recalculation — 20,000 customers bhi ek SQL statement me (loop nahi).
   * CTE (WITH ...): naya target nikalo → jinka badla unki history insert → customers update.
   * Returns: kitne customers ki category badli.
   */
  private recalculateAll(tx: Tx, actorId: string): Promise<number> {
    return tx.$executeRaw`
      WITH target AS (
        SELECT c.id AS customer_id, c.category_id AS from_id, c.interest_rating AS rating,
          (SELECT cat.id FROM categories cat
            WHERE cat.is_active AND c.interest_rating BETWEEN cat.min_rating AND cat.max_rating
            ORDER BY cat.sort_order LIMIT 1) AS to_id
        FROM customers c
        WHERE c.interest_rating IS NOT NULL OR c.category_id IS NOT NULL
      ),
      changed AS (
        SELECT * FROM target WHERE to_id IS DISTINCT FROM from_id
      ),
      history AS (
        INSERT INTO customer_category_changes
          (id, customer_id, from_category_id, to_category_id, rating, reason, changed_by_id, created_at)
        SELECT gen_random_uuid(), customer_id, from_id, to_id, rating, 'threshold_change', ${actorId}::uuid, now()
        FROM changed
      )
      UPDATE customers c
      SET category_id = ch.to_id,
          category_updated_at = now(),
          updated_at = now(),
          priority = COALESCE((SELECT cat.priority FROM categories cat WHERE cat.id = ch.to_id), c.priority)
      FROM changed ch
      WHERE c.id = ch.customer_id`;
  }
}
