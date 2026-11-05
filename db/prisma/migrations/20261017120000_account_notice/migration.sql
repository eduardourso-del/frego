-- Daily reminder: expiring carimbos/pontos/cashback, and a Promoção ending while Resgatar is open.
CREATE TABLE "account_notices" (
  "id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "notice_key" TEXT NOT NULL,
  "push_state" TEXT,
  "whatsapp_state" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "account_notices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_notices_notice_key_key" ON "account_notices"("notice_key");
CREATE INDEX "account_notices_membership_id_idx" ON "account_notices"("membership_id");

ALTER TABLE "account_notices"
  ADD CONSTRAINT "account_notices_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_whatsapp_connections"
  ADD COLUMN IF NOT EXISTS "template_notice_name" TEXT NOT NULL DEFAULT 'frego_account_notice_v1',
  ADD COLUMN IF NOT EXISTS "template_notice_lang" TEXT NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS "template_notice_status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS "template_notice_id" TEXT,
  ADD COLUMN IF NOT EXISTS "template_notice_synced_at" TIMESTAMP(3);
