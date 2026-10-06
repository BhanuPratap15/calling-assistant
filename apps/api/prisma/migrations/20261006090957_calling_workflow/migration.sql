-- AlterEnum
ALTER TYPE "assignment_source" ADD VALUE 'DISTRIBUTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "notification_type" ADD VALUE 'ASSIGNMENT_NEW';
ALTER TYPE "notification_type" ADD VALUE 'FORM_INCOMPLETE';
ALTER TYPE "notification_type" ADD VALUE 'ASSIGNMENT_AUTO_RELEASED';
ALTER TYPE "notification_type" ADD VALUE 'CAMPAIGN_EXHAUSTED';

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "release_reason" TEXT,
ADD COLUMN     "stale_notified_at" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "exhausted_notified_at" TIMESTAMPTZ(3);
