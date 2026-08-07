-- CreateEnum
CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('connected', 'disconnected', 'error');

-- CreateTable
CREATE TABLE "business_whatsapp_connections" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "meta_business_id" TEXT,
    "waba_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT,
    "verified_name" TEXT,
    "quality_rating" TEXT,
    "messaging_limit_tier" TEXT,
    "token_ciphertext" TEXT NOT NULL,
    "token_key_version" INTEGER NOT NULL DEFAULT 1,
    "template_earn_name" TEXT NOT NULL DEFAULT 'voltei_earn_summary',
    "template_earn_lang" TEXT NOT NULL DEFAULT 'pt_BR',
    "status" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'connected',
    "webhook_subscribed_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_whatsapp_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_webhook_events" (
    "id" TEXT NOT NULL,
    "business_id" TEXT,
    "event_key" TEXT NOT NULL,
    "phone_number_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_whatsapp_connections_business_id_key" ON "business_whatsapp_connections"("business_id");
CREATE UNIQUE INDEX "business_whatsapp_connections_phone_number_id_key" ON "business_whatsapp_connections"("phone_number_id");
CREATE INDEX "business_whatsapp_connections_waba_id_idx" ON "business_whatsapp_connections"("waba_id");
CREATE UNIQUE INDEX "whatsapp_webhook_events_event_key_key" ON "whatsapp_webhook_events"("event_key");
CREATE INDEX "whatsapp_webhook_events_business_id_created_at_idx" ON "whatsapp_webhook_events"("business_id", "created_at");
CREATE INDEX "whatsapp_webhook_events_phone_number_id_idx" ON "whatsapp_webhook_events"("phone_number_id");

ALTER TABLE "business_whatsapp_connections" ADD CONSTRAINT "business_whatsapp_connections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
