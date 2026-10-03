-- CreateTable
CREATE TABLE "call_outcomes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "call_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "next_actions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requires_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "next_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_outcomes_code_key" ON "call_outcomes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "next_actions_code_key" ON "next_actions"("code");

-- =====================================================================
-- DEFAULT DATA (design doc section 6) — "data migration"
-- Har environment me same defaults. Manager baad me Settings se badal sakta hai.
-- ON CONFLICT DO NOTHING = dobara chale to duplicate nahi.
-- =====================================================================

INSERT INTO "call_outcomes" ("id", "code", "label", "is_connected", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'CONNECTED',      'Connected',      true,  10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'INTERESTED',     'Interested',     true,  20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NOT_INTERESTED', 'Not Interested', true,  30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'NO_ANSWER',      'No Answer',      false, 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'BUSY',           'Busy',           false, 50, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SWITCHED_OFF',   'Switched Off',   false, 60, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'WRONG_NUMBER',   'Wrong Number',   false, 70, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "next_actions" ("id", "code", "label", "requires_follow_up", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'NO_FURTHER_ACTION', 'No Further Action', false, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FOLLOW_UP',         'Follow-up',         true,  20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CALL_AGAIN',        'Call Again',        true,  30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SEND_INFORMATION',  'Send Information',  false, 40, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ESCALATE',          'Escalate',          false, 50, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Call form ke optional/mandatory fields:
--   "always"    = har call pe zaroori
--   "connected" = sirf jab outcome "connected" ho (No Answer pe notes/rating ka matlab nahi)
--   "optional"  = kabhi zaroori nahi
-- Outcome aur Next Action hamesha zaroori hain (yahan configurable nahi).
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES
  ('call_form.required_fields',
   '{"userResponse": "connected", "notes": "connected", "interestRating": "connected"}'::jsonb,
   CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
