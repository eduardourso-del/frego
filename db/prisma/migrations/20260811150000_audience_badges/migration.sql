-- AlterTable
ALTER TABLE "audience_segments" ADD COLUMN "show_badge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "audience_segments" ADD COLUMN "badge_title" TEXT;
ALTER TABLE "audience_segments" ADD COLUMN "badge_message" TEXT;
