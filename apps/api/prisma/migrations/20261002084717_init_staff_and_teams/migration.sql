-- CreateEnum
CREATE TYPE "staff_role" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'TEAM_LEADER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "availability" AS ENUM ('AVAILABLE', 'ON_CALL', 'BREAK', 'OFFLINE');

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "staff_role" NOT NULL DEFAULT 'ASSISTANT',
    "availability" "availability" NOT NULL DEFAULT 'OFFLINE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "team_id" UUID,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "leader_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_team_id_idx" ON "staff"("team_id");

-- CreateIndex
CREATE INDEX "staff_role_availability_idx" ON "staff"("role", "availability");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE INDEX "teams_leader_id_idx" ON "teams"("leader_id");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
