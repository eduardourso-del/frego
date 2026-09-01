-- AlterEnum
ALTER TYPE "CampaignType" ADD VALUE 'cashback';

-- AlterTable
ALTER TABLE "businesses"
  ADD COLUMN "cashback_percent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cashback_max_cents" INTEGER,
  ADD COLUMN "cashback_min_purchase_cents" INTEGER,
  ADD COLUMN "cashback_expire_days" INTEGER;
