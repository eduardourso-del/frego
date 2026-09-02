-- Audience campaign WhatsApp template (same copy as push).
ALTER TABLE "business_whatsapp_connections"
  ADD COLUMN IF NOT EXISTS "template_campaign_name" TEXT NOT NULL DEFAULT 'frego_campaign_new',
  ADD COLUMN IF NOT EXISTS "template_campaign_lang" TEXT NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS "template_campaign_status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS "template_campaign_id" TEXT,
  ADD COLUMN IF NOT EXISTS "template_campaign_synced_at" TIMESTAMP(3);
