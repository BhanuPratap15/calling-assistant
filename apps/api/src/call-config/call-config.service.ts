import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import { diffChanges } from '../audit/diff.js';
import type { AuthUser } from '../auth/auth.types.js';
import { withUniqueConflict } from '../common/prisma-errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  DEFAULT_FOLLOW_UP_TIMING,
  DEFAULT_REQUIRED_FIELDS,
  FOLLOW_UP_TIMING_KEY,
  REQUIRED_FIELDS_KEY,
  type FollowUpTimingConfig,
  type RequiredFieldsConfig,
} from './call-config.types.js';
import type {
  CreateCallOutcomeDto,
  CreateNextActionDto,
  UpdateCallOutcomeDto,
  UpdateNextActionDto,
  UpdateFollowUpTimingDto,
  UpdateRequiredFieldsDto,
} from './dto/call-config.dto.js';

const ORDER = [{ sortOrder: 'asc' as const }, { label: 'asc' as const }];

@Injectable()
export class CallConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Call form ke liye sab kuch ek call me (assistant ki screen yahi use karegi).
   * includeInactive = admin settings screen (band kiye hue options bhi dikhao).
   */
  async getConfig(includeInactive = false) {
    const where = includeInactive ? undefined : { isActive: true };
    const [outcomes, nextActions, requiredFields, followUpTiming] =
      await Promise.all([
        this.prisma.callOutcome.findMany({ where, orderBy: ORDER }),
        this.prisma.nextAction.findMany({ where, orderBy: ORDER }),
        this.getRequiredFields(),
        this.getFollowUpTiming(),
      ]);
    return { outcomes, nextActions, requiredFields, followUpTiming };
  }

  async getRequiredFields(): Promise<RequiredFieldsConfig> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: REQUIRED_FIELDS_KEY },
    });
    // DB value + defaults (naya field add ho to purani setting me missing na rahe)
    return {
      ...DEFAULT_REQUIRED_FIELDS,
      ...((row?.value ?? {}) as Partial<RequiredFieldsConfig>),
    };
  }

  async getFollowUpTiming(): Promise<FollowUpTimingConfig> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: FOLLOW_UP_TIMING_KEY },
    });
    return {
      ...DEFAULT_FOLLOW_UP_TIMING,
      ...((row?.value ?? {}) as Partial<FollowUpTimingConfig>),
    };
  }

  async updateFollowUpTiming(dto: UpdateFollowUpTimingDto, actor: AuthUser) {
    const before = await this.getFollowUpTiming();
    const value: FollowUpTimingConfig = {
      reminderMinutesBefore: dto.reminderMinutesBefore,
      gracePeriodMinutes: dto.gracePeriodMinutes,
      presenceTimeoutMinutes: dto.presenceTimeoutMinutes,
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.systemSetting.upsert({
        where: { key: FOLLOW_UP_TIMING_KEY },
        create: {
          key: FOLLOW_UP_TIMING_KEY,
          value: { ...value },
          updatedById: actor.id,
        },
        update: { value: { ...value }, updatedById: actor.id },
      });
      await this.recordUpdate(
        tx,
        actor,
        AuditAction.SETTING_UPDATED,
        'setting',
        FOLLOW_UP_TIMING_KEY,
        diffChanges(before, value, [
          'reminderMinutesBefore',
          'gracePeriodMinutes',
          'presenceTimeoutMinutes',
        ]),
      );
    });
    return value;
  }

  // ---------- Call outcomes ----------

  createOutcome(dto: CreateCallOutcomeDto, actor: AuthUser) {
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const outcome = await tx.callOutcome.create({ data: dto });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.CALL_OUTCOME_CREATED,
              entityType: 'call_outcome',
              entityId: outcome.id,
              metadata: { code: outcome.code, label: outcome.label },
            },
            tx,
          );
          return outcome;
        }),
      `Call outcome with code ${dto.code} already exists`,
    );
  }

  async updateOutcome(id: string, dto: UpdateCallOutcomeDto, actor: AuthUser) {
    const before = await this.prisma.callOutcome.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Call outcome not found');
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.callOutcome.update({ where: { id }, data: dto });
      await this.recordUpdate(
        tx,
        actor,
        AuditAction.CALL_OUTCOME_UPDATED,
        'call_outcome',
        id,
        diffChanges(before, after, [
          'label',
          'isConnected',
          'isActive',
          'sortOrder',
        ]),
      );
      return after;
    });
  }

  // ---------- Next actions ----------

  createNextAction(dto: CreateNextActionDto, actor: AuthUser) {
    return withUniqueConflict(
      () =>
        this.prisma.$transaction(async (tx) => {
          const action = await tx.nextAction.create({ data: dto });
          await this.audit.record(
            {
              actorId: actor.id,
              action: AuditAction.NEXT_ACTION_CREATED,
              entityType: 'next_action',
              entityId: action.id,
              metadata: { code: action.code, label: action.label },
            },
            tx,
          );
          return action;
        }),
      `Next action with code ${dto.code} already exists`,
    );
  }

  async updateNextAction(
    id: string,
    dto: UpdateNextActionDto,
    actor: AuthUser,
  ) {
    const before = await this.prisma.nextAction.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Next action not found');
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.nextAction.update({ where: { id }, data: dto });
      await this.recordUpdate(
        tx,
        actor,
        AuditAction.NEXT_ACTION_UPDATED,
        'next_action',
        id,
        diffChanges(before, after, [
          'label',
          'requiresFollowUp',
          'isActive',
          'sortOrder',
        ]),
      );
      return after;
    });
  }

  // ---------- Required fields ----------

  async updateRequiredFields(dto: UpdateRequiredFieldsDto, actor: AuthUser) {
    const before = await this.getRequiredFields();
    const value: RequiredFieldsConfig = {
      userResponse: dto.userResponse,
      notes: dto.notes,
      interestRating: dto.interestRating,
    };
    await this.prisma.$transaction(async (tx) => {
      // upsert = hai to update, nahi to create
      await tx.systemSetting.upsert({
        where: { key: REQUIRED_FIELDS_KEY },
        create: {
          key: REQUIRED_FIELDS_KEY,
          value: { ...value },
          updatedById: actor.id,
        },
        update: { value: { ...value }, updatedById: actor.id },
      });
      await this.recordUpdate(
        tx,
        actor,
        AuditAction.SETTING_UPDATED,
        'setting',
        REQUIRED_FIELDS_KEY,
        diffChanges(before, value, ['userResponse', 'notes', 'interestRating']),
      );
    });
    return value;
  }

  private async recordUpdate(
    tx: Prisma.TransactionClient,
    actor: AuthUser,
    action: AuditAction,
    entityType: 'call_outcome' | 'next_action' | 'setting',
    entityId: string,
    changes: ReturnType<typeof diffChanges>,
  ) {
    if (!changes) return; // kuch nahi badla → audit entry nahi
    await this.audit.record(
      { actorId: actor.id, action, entityType, entityId, changes },
      tx,
    );
  }
}
