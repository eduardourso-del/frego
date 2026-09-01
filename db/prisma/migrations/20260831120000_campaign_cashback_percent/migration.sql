-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "cashback_percent" INTEGER;

-- Campanhas existentes herdam a taxa da loja.
UPDATE "campaigns" AS c
SET "cashback_percent" = b."cashback_percent"
FROM "businesses" AS b
WHERE c."business_id" = b.id
  AND c."type" = 'cashback'
  AND b."cashback_percent" > 0;
