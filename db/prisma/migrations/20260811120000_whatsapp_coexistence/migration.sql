-- Coexistence (WhatsApp Business app + Cloud API on the same number)
ALTER TABLE "business_whatsapp_connections"
  ADD COLUMN "coexistence" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "smb_sync_started_at" TIMESTAMP(3),
  ADD COLUMN "smb_contacts_sync_request_id" TEXT,
  ADD COLUMN "smb_history_sync_request_id" TEXT;
