import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../common/pagination.dto.js';
import { normalizePhone } from '../common/phone.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import type { Customer, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCustomerDto } from './dto/create-customer.dto.js';
import type { ListCustomersQueryDto } from './dto/list-customers-query.dto.js';
import type { UpdateCustomerDto } from './dto/update-customer.dto.js';

const DUPLICATE_MESSAGE =
  'A customer with this phone number or external ID already exists';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto, createdById: string): Promise<Customer> {
    const data = {
      ...dto,
      phone: this.requireValidPhone(dto.phone, 'phone'),
      alternatePhone: this.optionalPhone(dto.alternatePhone),
      email: dto.email?.trim().toLowerCase(),
      createdById,
    };
    return withUniqueConflict(
      () => this.prisma.customer.create({ data }),
      DUPLICATE_MESSAGE,
    );
  }

  async findAll(query: ListCustomersQueryDto): Promise<Paginated<Customer>> {
    const { page, pageSize, search, status, priority } = query;

    const where: Prisma.CustomerWhereInput = { status, priority };
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
        orderBy: { createdAt: 'desc' },
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

  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    await this.findOne(id); // nahi mila → 404
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
      () => this.prisma.customer.update({ where: { id }, data }),
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
