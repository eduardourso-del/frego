-- AlterTable
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('missing', 'pending', 'approved', 'rejected', 'paused', 'disabled');

-- AlterTable
ALTER TABLE "business_whatsapp_connections"
  ADD COLUMN "template_earn_status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'missing',
  ADD COLUMN "template_earn_id" TEXT,
  ADD COLUMN "template_earn_synced_at" TIMESTAMP(3);
