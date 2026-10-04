-- CreateEnum
CREATE TYPE "campaign_status" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "campaign_field_type" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'BOOLEAN');

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "campaign_id" UUID;

-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "campaign_id" UUID,
ADD COLUMN     "custom_fields" JSONB;

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "campaign_status" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "script" TEXT,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_customers" (
    "campaign_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "last_called_at" TIMESTAMPTZ(3),
    "last_outcome_id" UUID,
    "added_by_id" UUID,
    "added_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_customers_pkey" PRIMARY KEY ("campaign_id","customer_id")
);

-- CreateTable
CREATE TABLE "campaign_staff" (
    "campaign_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,

    CONSTRAINT "campaign_staff_pkey" PRIMARY KEY ("campaign_id","staff_id")
);

-- CreateTable
CREATE TABLE "campaign_teams" (
    "campaign_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,

    CONSTRAINT "campaign_teams_pkey" PRIMARY KEY ("campaign_id","team_id")
);

-- CreateTable
CREATE TABLE "campaign_fields" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "campaign_field_type" NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "campaign_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_name_key" ON "campaigns"("name");

-- CreateIndex
CREATE INDEX "campaigns_status_priority_idx" ON "campaigns"("status", "priority");

-- CreateIndex
CREATE INDEX "campaign_customers_campaign_id_call_count_added_at_idx" ON "campaign_customers"("campaign_id", "call_count", "added_at");

-- CreateIndex
CREATE INDEX "campaign_customers_customer_id_idx" ON "campaign_customers"("customer_id");

-- CreateIndex
CREATE INDEX "campaign_staff_staff_id_idx" ON "campaign_staff"("staff_id");

-- CreateIndex
CREATE INDEX "campaign_teams_team_id_idx" ON "campaign_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_fields_campaign_id_key_key" ON "campaign_fields"("campaign_id", "key");

-- CreateIndex
CREATE INDEX "calls_campaign_id_created_at_idx" ON "calls"("campaign_id", "created_at");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_customers" ADD CONSTRAINT "campaign_customers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_customers" ADD CONSTRAINT "campaign_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_customers" ADD CONSTRAINT "campaign_customers_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_staff" ADD CONSTRAINT "campaign_staff_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_staff" ADD CONSTRAINT "campaign_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_teams" ADD CONSTRAINT "campaign_teams_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_teams" ADD CONSTRAINT "campaign_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
