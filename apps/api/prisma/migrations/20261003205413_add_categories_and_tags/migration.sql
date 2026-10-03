-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "category_id" UUID,
ADD COLUMN     "category_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "interest_rating" INTEGER;

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "min_rating" INTEGER NOT NULL,
    "max_rating" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "priority" "priority",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_category_changes" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "from_category_id" UUID,
    "to_category_id" UUID,
    "rating" INTEGER,
    "reason" TEXT NOT NULL,
    "call_id" UUID,
    "changed_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_category_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "customer_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "added_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("customer_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE INDEX "customer_category_changes_customer_id_created_at_idx" ON "customer_category_changes"("customer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "customer_tags_tag_id_idx" ON "customer_tags"("tag_id");

-- CreateIndex
CREATE INDEX "customers_category_id_idx" ON "customers"("category_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_changes" ADD CONSTRAINT "customer_category_changes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_changes" ADD CONSTRAINT "customer_category_changes_from_category_id_fkey" FOREIGN KEY ("from_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_changes" ADD CONSTRAINT "customer_category_changes_to_category_id_fkey" FOREIGN KEY ("to_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_changes" ADD CONSTRAINT "customer_category_changes_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_category_changes" ADD CONSTRAINT "customer_category_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- DEFAULT DATA (design doc section 10 — example thresholds, configurable)
--   0–4 Low · 5–7 Medium · 8–9 High · 10 VIP
-- priority: category me aate hi customer ki priority (priority-aware assignment)
-- =====================================================================
INSERT INTO "categories" ("id", "code", "label", "min_rating", "max_rating", "color", "priority", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'LOW_INTEREST',    'Low Interest',    0,  4, 'gray',   'LOW',    10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MEDIUM_INTEREST', 'Medium Interest', 5,  7, 'blue',   'NORMAL', 20, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'HIGH_INTEREST',   'High Interest',   8,  9, 'yellow', 'HIGH',   30, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'VIP',             'VIP',             10, 10, 'red',   'URGENT', 40, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Phase 2/3 me jo calls pehle se hain: customer ki latest rating backfill
UPDATE "customers" c SET "interest_rating" = latest.rating
FROM (
  SELECT DISTINCT ON (customer_id) customer_id, interest_rating AS rating
  FROM "calls" WHERE interest_rating IS NOT NULL
  ORDER BY customer_id, created_at DESC
) latest
WHERE c.id = latest.customer_id;

-- ...aur unki category (history ke bina — ye initial assignment hai)
UPDATE "customers" c SET "category_id" = cat.id, "category_updated_at" = CURRENT_TIMESTAMP
FROM "categories" cat
WHERE c.interest_rating BETWEEN cat.min_rating AND cat.max_rating AND cat.is_active;
