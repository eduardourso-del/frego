-- One current FCM token per customer + platform. Keep the newest row.
DELETE FROM "device_tokens" a
USING "device_tokens" b
WHERE a.customer_id = b.customer_id
  AND a.platform = b.platform
  AND (
    a.updated_at < b.updated_at
    OR (a.updated_at = b.updated_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX "device_tokens_customer_id_platform_key"
  ON "device_tokens"("customer_id", "platform");
