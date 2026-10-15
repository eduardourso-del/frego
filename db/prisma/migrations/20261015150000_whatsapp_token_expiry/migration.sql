-- Remember when a WhatsApp business token expires, and when we last checked it.
ALTER TABLE "business_whatsapp_connections"
  ADD COLUMN "token_expires_at" TIMESTAMP(3),
  ADD COLUMN "token_checked_at" TIMESTAMP(3);
