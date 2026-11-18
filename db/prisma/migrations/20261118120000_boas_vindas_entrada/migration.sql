-- AlterTable
ALTER TABLE "customers" ADD COLUMN "boas_vindas_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "customers" ADD COLUMN "entrada_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "entrada_sent_at" TIMESTAMP(3);

-- Places already listed had their first appearance before Entrada existed.
UPDATE "businesses"
SET "entrada_sent_at" = CURRENT_TIMESTAMP
WHERE "exploration_visible" = true
  AND "status" IN ('trial', 'active');
