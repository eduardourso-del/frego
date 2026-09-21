-- AlterEnum
ALTER TYPE "CampaignType" ADD VALUE 'promo';

-- CreateEnum
CREATE TYPE "PromoRedeemPeriod" AS ENUM ('day', 'week', 'month', 'year', 'campaign');

-- AlterTable
ALTER TABLE "campaigns"
  ADD COLUMN "starts_on" DATE,
  ADD COLUMN "ends_on" DATE,
  ADD COLUMN "weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "redeem_max" INTEGER,
  ADD COLUMN "redeem_period" "PromoRedeemPeriod";
