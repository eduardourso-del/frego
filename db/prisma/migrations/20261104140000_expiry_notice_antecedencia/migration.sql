-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "expiry_notice_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "businesses" ADD COLUMN "expiry_notice_days" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "account_notices" ADD COLUMN "hold_until" TEXT;
