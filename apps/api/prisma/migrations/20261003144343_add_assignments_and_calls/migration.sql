-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "assignment_source" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "call_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_called_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "status" "assignment_status" NOT NULL,
    "source" "assignment_source" NOT NULL,
    "customer_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "created_by_id" UUID,
    "open_customer_id" UUID,
    "in_progress_staff_id" UUID,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "assignment_id" UUID,
    "outcome_id" UUID NOT NULL,
    "next_action_id" UUID NOT NULL,
    "user_response" TEXT,
    "notes" TEXT,
    "interest_rating" INTEGER,
    "follow_up_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignments_open_customer_id_key" ON "assignments"("open_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_in_progress_staff_id_key" ON "assignments"("in_progress_staff_id");

-- CreateIndex
CREATE INDEX "assignments_staff_id_status_idx" ON "assignments"("staff_id", "status");

-- CreateIndex
CREATE INDEX "assignments_customer_id_created_at_idx" ON "assignments"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "calls_customer_id_created_at_idx" ON "calls"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "calls_staff_id_created_at_idx" ON "calls"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "calls_created_at_idx" ON "calls"("created_at");

-- CreateIndex
CREATE INDEX "customers_status_last_called_at_priority_created_at_idx" ON "customers"("status", "last_called_at", "priority", "created_at");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "call_outcomes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_next_action_id_fkey" FOREIGN KEY ("next_action_id") REFERENCES "next_actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
