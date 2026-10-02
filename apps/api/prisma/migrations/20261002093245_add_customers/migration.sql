-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('ACTIVE', 'DO_NOT_CALL', 'INVALID');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternate_phone" TEXT,
    "email" TEXT,
    "status" "customer_status" NOT NULL DEFAULT 'ACTIVE',
    "priority" "priority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_external_id_key" ON "customers"("external_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_status_priority_idx" ON "customers"("status", "priority");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
