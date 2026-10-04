-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "ignored_columns" TEXT[] DEFAULT ARRAY[]::TEXT[];
