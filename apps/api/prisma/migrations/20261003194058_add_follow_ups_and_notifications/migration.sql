-- CreateEnum
CREATE TYPE "follow_up_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('FOLLOW_UP_REMINDER', 'FOLLOW_UP_DUE', 'FOLLOW_UP_ESCALATED_TO_YOU', 'FOLLOW_UP_ESCALATED_AWAY', 'FOLLOW_UP_OVERDUE', 'FOLLOW_UP_REASSIGNED');

-- AlterEnum
ALTER TYPE "assignment_source" ADD VALUE 'FOLLOW_UP';

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "follow_up_id" UUID;

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "last_seen_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "status" "follow_up_status" NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "customer_id" UUID NOT NULL,
    "source_call_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "original_owner_id" UUID NOT NULL,
    "open_customer_id" UUID,
    "reminder_sent_at" TIMESTAMPTZ(3),
    "due_notified_at" TIMESTAMPTZ(3),
    "overdue_notified_at" TIMESTAMPTZ(3),
    "escalated_at" TIMESTAMPTZ(3),
    "escalation_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_call_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "data" JSONB,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_source_call_id_key" ON "follow_ups"("source_call_id");

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_open_customer_id_key" ON "follow_ups"("open_customer_id");

-- CreateIndex
CREATE INDEX "follow_ups_status_due_at_idx" ON "follow_ups"("status", "due_at");

-- CreateIndex
CREATE INDEX "follow_ups_owner_id_status_due_at_idx" ON "follow_ups"("owner_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx" ON "notifications"("recipient_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_follow_up_id_fkey" FOREIGN KEY ("follow_up_id") REFERENCES "follow_ups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_original_owner_id_fkey" FOREIGN KEY ("original_owner_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_completed_by_call_id_fkey" FOREIGN KEY ("completed_by_call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- DEFAULT DATA: follow-up timing (design doc section 8.2 — configurable)
--   reminderMinutesBefore: due time se kitne minute pehle owner ko reminder
--   gracePeriodMinutes:    due ke baad kitna intezaar, phir escalate / overdue alert
--   presenceTimeoutMinutes: itni der se koi API request nahi → "away" maano (browser band)
-- =====================================================================
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES
  ('follow_up.timing',
   '{"reminderMinutesBefore": 1, "gracePeriodMinutes": 10, "presenceTimeoutMinutes": 5}'::jsonb,
   CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
