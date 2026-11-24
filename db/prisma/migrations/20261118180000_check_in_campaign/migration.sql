-- AlterEnum
ALTER TYPE "CampaignType" ADD VALUE 'checkin';

-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('counted', 'removed', 'consumed', 'ended');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "check_in_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_check_in_token_key" ON "campaigns"("check_in_token");

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "civil_date" TEXT NOT NULL,
    "status" "CheckInStatus" NOT NULL DEFAULT 'counted',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- One open row per civil day. An ended row is an archived run and does not block the day.
CREATE UNIQUE INDEX "check_ins_open_day" ON "check_ins"("campaign_id", "membership_id", "civil_date") WHERE "status" <> 'ended';

-- CreateIndex
CREATE INDEX "check_ins_campaign_id_membership_id_status_idx" ON "check_ins"("campaign_id", "membership_id", "status");

-- CreateIndex
CREATE INDEX "check_ins_membership_id_civil_date_idx" ON "check_ins"("membership_id", "civil_date");

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
