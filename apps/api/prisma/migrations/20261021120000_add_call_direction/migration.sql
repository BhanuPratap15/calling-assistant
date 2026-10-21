-- CreateEnum
CREATE TYPE "call_direction" AS ENUM ('OUTBOUND', 'INBOUND');

-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "direction" "call_direction" NOT NULL DEFAULT 'OUTBOUND';
