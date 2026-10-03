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
import type { Paginated } from '../common/pagination.dto.js';
import { normalizePhone } from '../common/phone.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import type { Customer, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCustomerDto } from './dto/create-customer.dto.js';
import type { ListCustomersQueryDto } from './dto/list-customers-query.dto.js';
import type { UpdateCustomerDto } from './dto/update-customer.dto.js';
import {
  customerProfileInclude,
  OPEN_ASSIGNMENT_WHERE,
  type CustomerProfile,
} from './customer-profile.js';

const DUPLICATE_MESSAGE =
  'A customer with this phone number or external ID already exists';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateCustomerDto, createdById: string): Promise<Customer> {
    const data = {
      ...dto,
      phone: this.requireValidPhone(dto.phone, 'phone'),
      alternatePhone: this.optionalPhone(dto.alternatePhone),
      email: dto.email?.trim().toLowerCase(),
      createdById,
    };
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const customer = await tx.customer.create({ data });
          await this.audit.record(
            {
              actorId: createdById,
              action: AuditAction.CUSTOMER_CREATED,
              entityType: 'customer',
              entityId: customer.id,
              metadata: { name: customer.name, phone: customer.phone },
            },
            tx,
          );
          return customer;
        }),
      DUPLICATE_MESSAGE,
    );
  }

  async findAll(query: ListCustomersQueryDto): Promise<Paginated<Customer>> {
    const {
      page,
      pageSize,
      search,
      status,
      priority,
      categoryId,
      tagId,
      sort,
    } = query;

    const where: Prisma.CustomerWhereInput = {
      status,
      priority,
      categoryId: categoryId === 'none' ? null : categoryId,
      tags: tagId ? { some: { tagId } } : undefined,
    };
    if (search?.trim()) {
      const term = search.trim();
      const digits = term.replace(/\D/g, '');
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { externalId: { equals: term } },
        // phone me sirf digits dhundo: "98765" se "+919876543210" mil jaaye
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
      ];
    }

    // Do queries ek saath (transaction): page ka data + total count
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        // "Assigned to" column ke liye open assignment ka staff
        include: {
          category: {
            select: { id: true, code: true, label: true, color: true },
          },
          tags: {
            select: { tag: { select: { id: true, name: true, color: true } } },
          },
          assignments: {
            where: OPEN_ASSIGNMENT_WHERE,
            select: {
              id: true,
              status: true,
              staff: { select: { id: true, name: true } },
            },
          },
        },
        orderBy:
          sort === 'rating'
            ? [
                { interestRating: { sort: 'desc', nulls: 'last' } },
                { createdAt: 'desc' },
              ]
            : { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /**
   * 360° profile. Manager / TL: koi bhi customer.
   * Assistant: sirf wahi customer jo abhi uske paas assigned hai ("permitted user history").
   */
  async getProfile(id: string, actor: AuthUser): Promise<CustomerProfile> {
    const profile = await this.prisma.customer.findUnique({
      where: { id },
      include: customerProfileInclude,
    });
    if (!profile) throw new NotFoundException('Customer not found');
    if (
      actor.role === 'ASSISTANT' &&
      !profile.assignments.some((a) => a.staff.id === actor.id)
    ) {
      throw new ForbiddenException('This customer is not assigned to you');
    }
    return profile;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    actorId: string,
  ): Promise<Customer> {
    const before = await this.findOne(id); // nahi mila → 404
    const data: Prisma.CustomerUpdateInput = {
      ...dto,
      phone:
        dto.phone === undefined
          ? undefined
          : this.requireValidPhone(dto.phone, 'phone'),
      alternatePhone:
        dto.alternatePhone === undefined
          ? undefined
          : this.optionalPhone(dto.alternatePhone),
      email: dto.email?.trim().toLowerCase(),
    };
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const after = await tx.customer.update({ where: { id }, data });
          const changes = diffChanges(before, after, [
            'name',
            'phone',
            'alternatePhone',
            'email',
            'externalId',
            'status',
            'priority',
            'notes',
          ]);
          if (changes) {
            await this.audit.record(
              {
                actorId,
                action: AuditAction.CUSTOMER_UPDATED,
                entityType: 'customer',
                entityId: id,
                changes,
              },
              tx,
            );
          }
          return after;
        }),
      DUPLICATE_MESSAGE,
    );
  }

  // ---- helpers ----

  private requireValidPhone(value: string, field: string): string {
    const phone = normalizePhone(value);
    if (!phone)
      throw new BadRequestException(`${field} is not a valid phone number`);
    return phone;
  }

  private optionalPhone(value?: string): string | null {
    if (!value?.trim()) return null;
    return this.requireValidPhone(value, 'alternatePhone');
  }
}
