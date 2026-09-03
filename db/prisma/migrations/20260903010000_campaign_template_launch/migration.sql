-- Rejected short frego_campaign_new body; submit a longer template name instead.
ALTER TABLE "business_whatsapp_connections"
  ALTER COLUMN "template_campaign_name" SET DEFAULT 'frego_campaign_launch';
