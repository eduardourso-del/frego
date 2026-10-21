-- Hold earn WhatsApp and push until a short quiet window passes, so a burst sends once.
CREATE TABLE "earn_notify_holds" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "send_after" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "earn_notify_holds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "earn_notify_holds_business_id_customer_id_key"
  ON "earn_notify_holds"("business_id", "customer_id");

CREATE INDEX "earn_notify_holds_send_after_idx"
  ON "earn_notify_holds"("send_after");

ALTER TABLE "earn_notify_holds"
  ADD CONSTRAINT "earn_notify_holds_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "earn_notify_holds"
  ADD CONSTRAINT "earn_notify_holds_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
