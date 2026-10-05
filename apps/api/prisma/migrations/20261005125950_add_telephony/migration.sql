-- CreateEnum
CREATE TYPE "call_session_status" AS ENUM ('DIALED', 'INITIATED', 'RINGING', 'ANSWERED', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_call_id" TEXT,
    "customer_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "assignment_id" UUID,
    "call_id" UUID,
    "to_number" TEXT NOT NULL,
    "status" "call_session_status" NOT NULL,
    "answered_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),
    "duration_sec" INTEGER,
    "recording_url" TEXT,
    "fail_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "applied" BOOLEAN NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_sessions_assignment_id_created_at_idx" ON "call_sessions"("assignment_id", "created_at");

-- CreateIndex
CREATE INDEX "call_sessions_customer_id_created_at_idx" ON "call_sessions"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "call_sessions_staff_id_created_at_idx" ON "call_sessions"("staff_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "call_sessions_provider_provider_call_id_key" ON "call_sessions"("provider", "provider_call_id");

-- CreateIndex
CREATE INDEX "call_events_session_id_occurred_at_idx" ON "call_events"("session_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "call_events_provider_event_id_key" ON "call_events"("provider", "event_id");

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "call_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
