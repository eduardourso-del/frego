-- Welcome WhatsApp template status on business connections.
ALTER TABLE "business_whatsapp_connections"
  ADD COLUMN IF NOT EXISTS "template_welcome_name" TEXT NOT NULL DEFAULT 'frego_welcome',
  ADD COLUMN IF NOT EXISTS "template_welcome_lang" TEXT NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS "template_welcome_status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS "template_welcome_id" TEXT,
  ADD COLUMN IF NOT EXISTS "template_welcome_synced_at" TIMESTAMP(3);
