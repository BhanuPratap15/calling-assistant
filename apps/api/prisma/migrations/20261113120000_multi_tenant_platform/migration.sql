-- =====================================================================
-- Multi-tenant platform (white-label SaaS).
-- Existing data -> ek "default" organization (brand: Addaplay). Kuch delete nahi hota.
-- =====================================================================

-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "dialer_mode" AS ENUM ('PLATFORM', 'EXTERNAL_PANEL', 'PHONE');

-- CreateEnum
CREATE TYPE "domain_type" AS ENUM ('SUBDOMAIN', 'CUSTOM');

-- CreateEnum
CREATE TYPE "domain_status" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "organization_status" NOT NULL DEFAULT 'ACTIVE',
    "brand_name" TEXT NOT NULL,
    "tagline" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "theme_preset" TEXT NOT NULL DEFAULT 'violet',
    "primary_color" TEXT,
    "sidebar_style" TEXT NOT NULL DEFAULT 'dark',
    "login_style" TEXT NOT NULL DEFAULT 'split',
    "support_email" TEXT,
    "support_phone" TEXT,
    "dialer_mode" "dialer_mode" NOT NULL DEFAULT 'PLATFORM',
    "external_dialer_url" TEXT,
    "plan" TEXT,
    "max_staff" INTEGER,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_domains" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "type" "domain_type" NOT NULL,
    "status" "domain_status" NOT NULL DEFAULT 'PENDING',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "checked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "organization_id" UUID,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Default organization: aaj tak ka saara data isi ka
INSERT INTO "organizations" ("id", "name", "slug", "brand_name", "updated_at")
VALUES ('00000000-0000-4000-8000-000000000001', 'Addaplay', 'default', 'Addaplay', CURRENT_TIMESTAMP);

-- DropIndex
DROP INDEX "staff_email_key";

-- DropIndex
DROP INDEX "teams_name_key";

-- DropIndex
DROP INDEX "customers_external_id_key";

-- DropIndex
DROP INDEX "customers_phone_key";

-- DropIndex
DROP INDEX "call_outcomes_code_key";

-- DropIndex
DROP INDEX "next_actions_code_key";

-- DropIndex
DROP INDEX "categories_code_key";

-- DropIndex
DROP INDEX "tags_name_key";

-- DropIndex
DROP INDEX "campaigns_name_key";

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "call_outcomes" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "next_actions" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_pkey",
ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001',
ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("organization_id", "key");

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "follow_ups" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "customer_category_changes" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "tags" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "customer_tags" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "campaign_customers" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "campaign_staff" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "campaign_teams" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "campaign_fields" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "import_rows" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "call_sessions" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- AlterTable
ALTER TABLE "call_events" ADD COLUMN     "organization_id" UUID NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001';

-- Backfill ho gaya. Ab default = current_setting('app.tenant_id') — app (tenant extension)
-- organization_id hamesha khud deta hai; bhool jaaye to ye default ERROR deta hai (setting nahi hoti),
-- row galti se kisi aur client me nahi jaati.
ALTER TABLE "staff" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "teams" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "customers" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "call_outcomes" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "next_actions" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "system_settings" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "assignments" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "calls" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "follow_ups" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "notifications" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "categories" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "customer_category_changes" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "tags" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "customer_tags" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "campaigns" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "campaign_customers" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "campaign_staff" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "campaign_teams" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "campaign_fields" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "import_batches" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "import_rows" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "call_sessions" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;
ALTER TABLE "call_events" ALTER COLUMN "organization_id" SET DEFAULT (current_setting('app.tenant_id'::text))::uuid;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_domains_hostname_key" ON "organization_domains"("hostname");

-- CreateIndex
CREATE INDEX "organization_domains_organization_id_idx" ON "organization_domains"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE INDEX "platform_audit_logs_organization_id_created_at_idx" ON "platform_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "staff_organization_id_idx" ON "staff"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_organization_id_email_key" ON "staff"("organization_id", "email");

-- CreateIndex
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_name_key" ON "teams"("organization_id", "name");

-- CreateIndex
CREATE INDEX "customers_organization_id_status_priority_idx" ON "customers"("organization_id", "status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_external_id_key" ON "customers"("organization_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organization_id_phone_key" ON "customers"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "call_outcomes_organization_id_idx" ON "call_outcomes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_outcomes_organization_id_code_key" ON "call_outcomes"("organization_id", "code");

-- CreateIndex
CREATE INDEX "next_actions_organization_id_idx" ON "next_actions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "next_actions_organization_id_code_key" ON "next_actions"("organization_id", "code");

-- CreateIndex
CREATE INDEX "system_settings_organization_id_idx" ON "system_settings"("organization_id");

-- CreateIndex
CREATE INDEX "assignments_organization_id_status_idx" ON "assignments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "calls_organization_id_created_at_idx" ON "calls"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "follow_ups_organization_id_status_due_at_idx" ON "follow_ups"("organization_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_idx" ON "notifications"("organization_id");

-- CreateIndex
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_organization_id_code_key" ON "categories"("organization_id", "code");

-- CreateIndex
CREATE INDEX "customer_category_changes_organization_id_idx" ON "customer_category_changes"("organization_id");

-- CreateIndex
CREATE INDEX "tags_organization_id_idx" ON "tags"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organization_id_name_key" ON "tags"("organization_id", "name");

-- CreateIndex
CREATE INDEX "customer_tags_organization_id_idx" ON "customer_tags"("organization_id");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_idx" ON "campaigns"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_organization_id_name_key" ON "campaigns"("organization_id", "name");

-- CreateIndex
CREATE INDEX "campaign_customers_organization_id_idx" ON "campaign_customers"("organization_id");

-- CreateIndex
CREATE INDEX "campaign_staff_organization_id_idx" ON "campaign_staff"("organization_id");

-- CreateIndex
CREATE INDEX "campaign_teams_organization_id_idx" ON "campaign_teams"("organization_id");

-- CreateIndex
CREATE INDEX "campaign_fields_organization_id_idx" ON "campaign_fields"("organization_id");

-- CreateIndex
CREATE INDEX "import_batches_organization_id_idx" ON "import_batches"("organization_id");

-- CreateIndex
CREATE INDEX "import_rows_organization_id_idx" ON "import_rows"("organization_id");

-- CreateIndex
CREATE INDEX "call_sessions_organization_id_created_at_idx" ON "call_sessions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "call_events_organization_id_idx" ON "call_events"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_domains" ADD CONSTRAINT "organization_domains_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_outcomes" ADD CONSTRAINT "call_outcomes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_changes" ADD CONSTRAINT "customer_category_changes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_customers" ADD CONSTRAINT "campaign_customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_staff" ADD CONSTRAINT "campaign_staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_teams" ADD CONSTRAINT "campaign_teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_fields" ADD CONSTRAINT "campaign_fields_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
