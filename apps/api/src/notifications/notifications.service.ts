import { Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationType, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type DbClient = PrismaService | Prisma.TransactionClient;

export interface NewNotification {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  data?: Record<string, unknown>;
}

/** In-app notifications (design doc section 18). Asli kaam ke saath same transaction me likho. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(
    items: NewNotification[],
    db: DbClient = this.prisma,
  ): Promise<void> {
    if (!items.length) return;
    await db.notification.createMany({
      data: items.map((n) => ({
        ...n,
        data: n.data as Prisma.InputJsonValue | undefined,
      })),
    });
  }

  list(recipientId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { recipientId, readAt: unreadOnly ? null : undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(recipientId: string) {
    return {
      count: await this.prisma.notification.count({
        where: { recipientId, readAt: null },
      }),
    };
  }

  async markRead(id: string, recipientId: string) {
    // recipientId bhi where me — koi doosre ki notification read na kar sake
    const { count } = await this.prisma.notification.updateMany({
      where: { id, recipientId, readAt: null },
      data: { readAt: new Date() },
    });
    if (!count) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, recipientId },
      });
      if (!exists) throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(recipientId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
