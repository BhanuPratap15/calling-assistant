import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/audit.types.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CallConfigService } from '../call-config/call-config.service.js';
import { toCsv } from '../common/csv.js';
import { staffScope } from '../common/team-scope.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ExportType, ReportQueryDto } from './dto/report-query.dto.js';
import {
  previousRange,
  RangeError,
  resolveRange,
  type ResolvedRange,
} from './report-range.js';

/** CSV me itni lines se zyada → "range chhoti karo" (server memory safe) */
export const MAX_EXPORT_ROWS = 50_000;

interface Scope {
  range: ResolvedRange;
  staffIds: string[] | null; // null = sab
  campaignId?: string;
}

const pct = (part: number, total: number) =>
  total === 0 ? null : Math.round((part / total) * 1000) / 10;

/**
 * Dashboard + reports (design doc section 15). Saare numbers SQL aggregates se —
 * 20k customers / lakhs calls pe bhi ek-ek row JS me nahi aati.
 * Time zone: REPORT_TIMEZONE (default Asia/Kolkata) — "aaj" India ka aaj.
 */
@Injectable()
export class ReportsService {
  readonly tz: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly callConfig: CallConfigService,
    config: ConfigService,
  ) {
    this.tz = config.get<string>('REPORT_TIMEZONE', 'Asia/Kolkata');
    try {
      new Intl.DateTimeFormat('en', { timeZone: this.tz });
    } catch {
      throw new Error(`Invalid REPORT_TIMEZONE "${this.tz}"`); // galat config → app start nahi
    }
  }

  // ---------------- scope (kaun kiska data dekh sakta hai) ----------------

  private async scope(actor: AuthUser, q: ReportQueryDto): Promise<Scope> {
    let range: ResolvedRange;
    try {
      range = resolveRange({
        preset: q.range,
        from: q.from,
        to: q.to,
        now: new Date(),
        tz: this.tz,
      });
    } catch (e) {
      if (e instanceof RangeError) throw new BadRequestException(e.message);
      throw e;
    }

    // ASSISTANT → sirf khud; TEAM_LEADER → khud + team; MANAGER → sab
    let staffIds = await staffScope(this.prisma, actor);
    const allowed = (id: string) => staffIds === null || staffIds.includes(id);

    if (q.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: q.teamId },
        select: { leaderId: true, members: { select: { id: true } } },
      });
      if (!team) throw new BadRequestException('Team not found');
      if (actor.role === 'TEAM_LEADER' && team.leaderId !== actor.id)
        throw new ForbiddenException('Not your team');
      if (actor.role === 'ASSISTANT')
        throw new ForbiddenException('Team filter not allowed');
      const members = team.members.map((m) => m.id);
      staffIds =
        staffIds === null
          ? members
          : staffIds.filter((id) => members.includes(id));
    }
    if (q.staffId) {
      if (!allowed(q.staffId))
        throw new ForbiddenException('Not allowed to see this staff');
      staffIds =
        staffIds === null || staffIds.includes(q.staffId) ? [q.staffId] : [];
    }
    return { range, staffIds, campaignId: q.campaignId };
  }

  private staffCond(alias: string, ids: string[] | null) {
    return ids === null
      ? Prisma.empty
      : Prisma.sql`AND ${Prisma.raw(alias)}.staff_id = ANY(${ids}::uuid[])`;
  }

  private campaignCond(alias: string, campaignId?: string) {
    return campaignId
      ? Prisma.sql`AND ${Prisma.raw(alias)}.campaign_id = ${campaignId}::uuid`
      : Prisma.empty;
  }

  private async graceMs() {
    return (
      (await this.callConfig.getFollowUpTiming()).gracePeriodMinutes * 60_000
    );
  }

  // ---------------- 1) summary (dashboard) ----------------

  async summary(actor: AuthUser, q: ReportQueryDto) {
    const s = await this.scope(actor, q);
    const { start, end } = s.range;
    const prev = previousRange(s.range, this.tz);
    const callWhere = (from: Date, to: Date) => Prisma.sql`
      c.created_at >= ${from} AND c.created_at < ${to}
      ${this.staffCond('c', s.staffIds)} ${this.campaignCond('c', s.campaignId)}`;

    const kpiSql = (from: Date, to: Date) => Prisma.sql`
      SELECT count(*)::int AS calls,
             count(*) FILTER (WHERE o.is_connected)::int AS connected,
             round(avg(c.interest_rating), 1)::float AS avg_rating,
             count(DISTINCT c.customer_id)::int AS customers,
             count(*) FILTER (WHERE na.requires_follow_up)::int AS follow_ups_promised
      FROM calls c
      JOIN call_outcomes o ON o.id = c.outcome_id
      JOIN next_actions na ON na.id = c.next_action_id
      WHERE ${callWhere(from, to)}`;

    type Kpi = {
      calls: number;
      connected: number;
      avg_rating: number | null;
      customers: number;
      follow_ups_promised: number;
    };
    const grace = await this.graceMs();
    const now = new Date();

    const [[cur], [before], daily, hourly, outcomes, [talk], [fu]] =
      await Promise.all([
        this.prisma.$queryRaw<Kpi[]>(kpiSql(start, end)),
        this.prisma.$queryRaw<Kpi[]>(kpiSql(prev.start, prev.end)),
        this.prisma.$queryRaw<
          { day: string; calls: number; connected: number }[]
        >`
        SELECT to_char(c.created_at AT TIME ZONE ${this.tz}, 'YYYY-MM-DD') AS day,
               count(*)::int AS calls,
               count(*) FILTER (WHERE o.is_connected)::int AS connected
        FROM calls c JOIN call_outcomes o ON o.id = c.outcome_id
        WHERE ${callWhere(start, end)}
        GROUP BY 1`,
        this.prisma.$queryRaw<
          { hour: number; calls: number; connected: number }[]
        >`
        SELECT extract(hour FROM c.created_at AT TIME ZONE ${this.tz})::int AS hour,
               count(*)::int AS calls,
               count(*) FILTER (WHERE o.is_connected)::int AS connected
        FROM calls c JOIN call_outcomes o ON o.id = c.outcome_id
        WHERE ${callWhere(start, end)}
        GROUP BY 1`,
        this.prisma.$queryRaw<
          { label: string; is_connected: boolean; calls: number }[]
        >`
        SELECT o.label, o.is_connected, count(*)::int AS calls
        FROM calls c JOIN call_outcomes o ON o.id = c.outcome_id
        WHERE ${callWhere(start, end)}
        GROUP BY o.id, o.label, o.is_connected
        ORDER BY calls DESC, o.label`,
        this.prisma.$queryRaw<
          { dials: number; answered: number; talk_sec: number }[]
        >`
        SELECT count(*)::int AS dials,
               count(*) FILTER (WHERE s.answered_at IS NOT NULL)::int AS answered,
               coalesce(sum(s.duration_sec) FILTER (WHERE s.status = 'COMPLETED'), 0)::int AS talk_sec
        FROM call_sessions s
        WHERE s.created_at >= ${start} AND s.created_at < ${end}
          ${this.staffCond('s', s.staffIds)}
          ${s.campaignId ? Prisma.sql`AND EXISTS (SELECT 1 FROM calls cc WHERE cc.id = s.call_id AND cc.campaign_id = ${s.campaignId}::uuid)` : Prisma.empty}`,
        this.prisma.$queryRaw<
          {
            due: number;
            completed: number;
            on_time: number;
            escalated: number;
            overdue_now: number;
          }[]
        >`
        SELECT count(*) FILTER (WHERE f.due_at >= ${start} AND f.due_at < ${end})::int AS due,
               count(*) FILTER (WHERE f.due_at >= ${start} AND f.due_at < ${end} AND f.status = 'COMPLETED')::int AS completed,
               count(*) FILTER (WHERE f.due_at >= ${start} AND f.due_at < ${end} AND f.status = 'COMPLETED'
                                AND f.completed_at <= f.due_at + make_interval(secs => ${grace / 1000}))::int AS on_time,
               count(*) FILTER (WHERE f.due_at >= ${start} AND f.due_at < ${end} AND f.escalation_count > 0)::int AS escalated,
               count(*) FILTER (WHERE f.status IN ('PENDING', 'IN_PROGRESS')
                                AND f.due_at < ${new Date(now.getTime() - grace)})::int AS overdue_now
        FROM follow_ups f
        JOIN calls sc ON sc.id = f.source_call_id
        WHERE TRUE ${s.staffIds === null ? Prisma.empty : Prisma.sql`AND f.owner_id = ANY(${s.staffIds}::uuid[])`}
          ${this.campaignCond('sc', s.campaignId)}`,
      ]);

    const byDay = new Map(daily.map((d) => [d.day, d]));
    const byHour = new Map(hourly.map((h) => [h.hour, h]));
    return {
      range: {
        preset: s.range.preset,
        start,
        end,
        days: s.range.days.length,
        timezone: this.tz,
      },
      kpis: {
        calls: cur.calls,
        connected: cur.connected,
        connectRate: pct(cur.connected, cur.calls),
        avgRating: cur.avg_rating,
        customers: cur.customers,
        followUpsPromised: cur.follow_ups_promised,
        dials: talk.dials,
        answered: talk.answered,
        talkTimeSec: talk.talk_sec,
      },
      previous: {
        calls: before.calls,
        connectRate: pct(before.connected, before.calls),
        avgRating: before.avg_rating,
      },
      daily: s.range.days.map((day) => ({
        day,
        calls: byDay.get(day)?.calls ?? 0,
        connected: byDay.get(day)?.connected ?? 0,
      })),
      byHour: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        calls: byHour.get(hour)?.calls ?? 0,
        connected: byHour.get(hour)?.connected ?? 0,
      })),
      outcomes: outcomes.map((o) => ({
        label: o.label,
        isConnected: o.is_connected,
        calls: o.calls,
      })),
      followUps: {
        due: fu.due,
        completed: fu.completed,
        onTime: fu.on_time,
        onTimeRate: pct(fu.on_time, fu.due),
        escalated: fu.escalated,
        overdueNow: fu.overdue_now,
      },
    };
  }

  // ---------------- 2) assistant performance ----------------

  async assistants(actor: AuthUser, q: ReportQueryDto) {
    const s = await this.scope(actor, q);
    const { start, end } = s.range;
    const grace = await this.graceMs();
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        role: string;
        team: string | null;
        availability: string;
        last_seen_at: Date | null;
        calls: number;
        connected: number;
        avg_rating: number | null;
        follow_ups_promised: number;
        dials: number;
        talk_sec: number;
        follow_ups_due: number;
        follow_ups_completed: number;
        overdue_now: number;
        last_call_at: Date | null;
      }[]
    >`
      WITH c AS (
        SELECT c.staff_id, count(*)::int AS calls,
               count(*) FILTER (WHERE o.is_connected)::int AS connected,
               round(avg(c.interest_rating), 1)::float AS avg_rating,
               count(*) FILTER (WHERE na.requires_follow_up)::int AS follow_ups_promised,
               max(c.created_at) AS last_call_at
        FROM calls c
        JOIN call_outcomes o ON o.id = c.outcome_id
        JOIN next_actions na ON na.id = c.next_action_id
        WHERE c.created_at >= ${start} AND c.created_at < ${end} ${this.campaignCond('c', s.campaignId)}
        GROUP BY c.staff_id
      ), t AS (
        SELECT s.staff_id, count(*)::int AS dials,
               coalesce(sum(s.duration_sec) FILTER (WHERE s.status = 'COMPLETED'), 0)::int AS talk_sec
        FROM call_sessions s
        WHERE s.created_at >= ${start} AND s.created_at < ${end}
          ${s.campaignId ? Prisma.sql`AND EXISTS (SELECT 1 FROM calls cc WHERE cc.id = s.call_id AND cc.campaign_id = ${s.campaignId}::uuid)` : Prisma.empty}
        GROUP BY s.staff_id
      ), f AS (
        SELECT f.owner_id,
               count(*) FILTER (WHERE f.due_at >= ${start} AND f.due_at < ${end})::int AS due,
               count(*) FILTER (WHERE f.due_at >= ${start} AND f.due_at < ${end} AND f.status = 'COMPLETED')::int AS completed,
               count(*) FILTER (WHERE f.status IN ('PENDING', 'IN_PROGRESS')
                                AND f.due_at < ${new Date(Date.now() - grace)})::int AS overdue_now
        FROM follow_ups f GROUP BY f.owner_id
      )
      SELECT st.id, st.name, st.role::text AS role, tm.name AS team, st.availability::text AS availability,
             st.last_seen_at,
             coalesce(c.calls, 0) AS calls, coalesce(c.connected, 0) AS connected, c.avg_rating,
             coalesce(c.follow_ups_promised, 0) AS follow_ups_promised,
             coalesce(t.dials, 0) AS dials, coalesce(t.talk_sec, 0) AS talk_sec,
             coalesce(f.due, 0) AS follow_ups_due, coalesce(f.completed, 0) AS follow_ups_completed,
             coalesce(f.overdue_now, 0) AS overdue_now, c.last_call_at
      FROM staff st
      LEFT JOIN teams tm ON tm.id = st.team_id
      LEFT JOIN c ON c.staff_id = st.id
      LEFT JOIN t ON t.staff_id = st.id
      LEFT JOIN f ON f.owner_id = st.id
      WHERE st.role::text IN ('ASSISTANT', 'TEAM_LEADER')
        AND (st.is_active OR c.calls > 0)
        ${s.staffIds === null ? Prisma.empty : Prisma.sql`AND st.id = ANY(${s.staffIds}::uuid[])`}
      ORDER BY coalesce(c.calls, 0) DESC, st.name`;

    return {
      range: { preset: s.range.preset, start, end, timezone: this.tz },
      assistants: rows.map((r) => ({
        id: r.id,
        name: r.name,
        role: r.role,
        team: r.team,
        availability: r.availability,
        lastSeenAt: r.last_seen_at,
        calls: r.calls,
        connected: r.connected,
        connectRate: pct(r.connected, r.calls),
        avgRating: r.avg_rating,
        followUpsPromised: r.follow_ups_promised,
        dials: r.dials,
        talkTimeSec: r.talk_sec,
        avgTalkSec: r.connected ? Math.round(r.talk_sec / r.connected) : null,
        followUpsDue: r.follow_ups_due,
        followUpsCompleted: r.follow_ups_completed,
        overdueNow: r.overdue_now,
        lastCallAt: r.last_call_at,
      })),
    };
  }

  // ---------------- 3) campaign performance ----------------

  async campaigns(actor: AuthUser, q: ReportQueryDto) {
    const s = await this.scope(actor, q);
    const { start, end } = s.range;
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        status: string;
        priority: number;
        customers: number;
        called: number;
        calls: number;
        connected: number;
        avg_rating: number | null;
      }[]
    >`
      WITH x AS (
        SELECT c.campaign_id, count(*)::int AS calls,
               count(*) FILTER (WHERE o.is_connected)::int AS connected,
               round(avg(c.interest_rating), 1)::float AS avg_rating
        FROM calls c JOIN call_outcomes o ON o.id = c.outcome_id
        WHERE c.campaign_id IS NOT NULL AND c.created_at >= ${start} AND c.created_at < ${end}
          ${this.staffCond('c', s.staffIds)}
        GROUP BY c.campaign_id
      ), p AS (
        SELECT cc.campaign_id, count(*)::int AS customers,
               count(*) FILTER (WHERE cc.call_count > 0)::int AS called
        FROM campaign_customers cc GROUP BY cc.campaign_id
      )
      SELECT k.id, k.name, k.status::text AS status, k.priority,
             coalesce(p.customers, 0) AS customers, coalesce(p.called, 0) AS called,
             coalesce(x.calls, 0) AS calls, coalesce(x.connected, 0) AS connected, x.avg_rating
      FROM campaigns k
      LEFT JOIN p ON p.campaign_id = k.id
      LEFT JOIN x ON x.campaign_id = k.id
      WHERE (k.status::text <> 'DRAFT' OR x.calls > 0)
        ${s.campaignId ? Prisma.sql`AND k.id = ${s.campaignId}::uuid` : Prisma.empty}
      ORDER BY (k.status::text = 'ACTIVE') DESC, coalesce(x.calls, 0) DESC, k.name`;

    return {
      range: { preset: s.range.preset, start, end, timezone: this.tz },
      campaigns: rows.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        priority: r.priority,
        customers: r.customers,
        called: r.called,
        progress: pct(r.called, r.customers),
        calls: r.calls,
        connected: r.connected,
        connectRate: pct(r.connected, r.calls),
        avgRating: r.avg_rating,
      })),
    };
  }

  // ---------------- 4) CSV export ----------------

  async exportCsv(actor: AuthUser, type: ExportType, q: ReportQueryDto) {
    let csv: string;
    let rowCount: number;
    if (type === 'assistants') {
      const { assistants } = await this.assistants(actor, q);
      rowCount = assistants.length;
      csv = toCsv(
        [
          'name',
          'role',
          'team',
          'calls',
          'connected',
          'connect_rate_%',
          'avg_rating',
          'follow_ups_promised',
          'follow_ups_due',
          'follow_ups_completed',
          'overdue_now',
          'dials',
          'talk_time_sec',
          'avg_talk_sec',
          'last_call_at',
        ],
        assistants.map((a) => [
          a.name,
          a.role,
          a.team,
          a.calls,
          a.connected,
          a.connectRate,
          a.avgRating,
          a.followUpsPromised,
          a.followUpsDue,
          a.followUpsCompleted,
          a.overdueNow,
          a.dials,
          a.talkTimeSec,
          a.avgTalkSec,
          a.lastCallAt,
        ]),
      );
    } else if (type === 'campaigns') {
      const { campaigns } = await this.campaigns(actor, q);
      rowCount = campaigns.length;
      csv = toCsv(
        [
          'campaign',
          'status',
          'priority',
          'customers',
          'called_all_time',
          'progress_%',
          'calls_in_range',
          'connected',
          'connect_rate_%',
          'avg_rating',
        ],
        campaigns.map((c) => [
          c.name,
          c.status,
          c.priority,
          c.customers,
          c.called,
          c.progress,
          c.calls,
          c.connected,
          c.connectRate,
          c.avgRating,
        ]),
      );
    } else {
      const s = await this.scope(actor, q);
      const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
        SELECT to_char(c.created_at AT TIME ZONE ${this.tz}, 'YYYY-MM-DD HH24:MI') AS called_at,
               st.name AS assistant, tm.name AS team, cu.name AS customer, cu.phone, cu.external_id,
               o.label AS outcome, o.is_connected AS connected, na.label AS next_action,
               c.interest_rating, to_char(c.follow_up_at AT TIME ZONE ${this.tz}, 'YYYY-MM-DD HH24:MI') AS follow_up_at,
               k.name AS campaign, c.user_response, c.notes,
               (SELECT coalesce(sum(s.duration_sec), 0)::int FROM call_sessions s WHERE s.call_id = c.id) AS talk_time_sec,
               (SELECT s.recording_url FROM call_sessions s WHERE s.call_id = c.id AND s.recording_url IS NOT NULL
                ORDER BY s.created_at DESC LIMIT 1) AS recording_url
        FROM calls c
        JOIN staff st ON st.id = c.staff_id
        LEFT JOIN teams tm ON tm.id = st.team_id
        JOIN customers cu ON cu.id = c.customer_id
        JOIN call_outcomes o ON o.id = c.outcome_id
        JOIN next_actions na ON na.id = c.next_action_id
        LEFT JOIN campaigns k ON k.id = c.campaign_id
        WHERE c.created_at >= ${s.range.start} AND c.created_at < ${s.range.end}
          ${this.staffCond('c', s.staffIds)} ${this.campaignCond('c', s.campaignId)}
        ORDER BY c.created_at
        LIMIT ${MAX_EXPORT_ROWS + 1}`;
      if (rows.length > MAX_EXPORT_ROWS)
        throw new BadRequestException(
          `More than ${MAX_EXPORT_ROWS} calls — choose a shorter date range`,
        );
      rowCount = rows.length;
      const cols = [
        'called_at',
        'assistant',
        'team',
        'customer',
        'phone',
        'external_id',
        'outcome',
        'connected',
        'next_action',
        'interest_rating',
        'follow_up_at',
        'campaign',
        'user_response',
        'notes',
        'talk_time_sec',
        'recording_url',
      ];
      csv = toCsv(
        cols,
        rows.map((r) => cols.map((c) => r[c])),
      );
    }

    // Customer phone numbers wala data bahar ja raha hai → audit (kisne, kab, kya)
    await this.audit.record({
      actorId: actor.id,
      action: AuditAction.REPORT_EXPORTED,
      entityType: 'report',
      metadata: {
        type,
        rows: rowCount,
        range: q.range,
        from: q.from,
        to: q.to,
        staffId: q.staffId,
        teamId: q.teamId,
        campaignId: q.campaignId,
      },
    });
    return csv;
  }
}
