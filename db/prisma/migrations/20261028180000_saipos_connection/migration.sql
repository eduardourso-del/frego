-- Closed Saipos sales credit the Clube. The token stays encrypted; each id_sale is imported once.

CREATE TYPE "SaiposConnectionStatus" AS ENUM ('connected', 'error');
CREATE TYPE "SaiposSaleStatus" AS ENUM ('processing', 'credited', 'skipped', 'reversed', 'reverse_blocked');

CREATE TABLE "business_saipos_connections" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "token_ciphertext" TEXT NOT NULL,
  "token_key_version" INTEGER NOT NULL DEFAULT 1,
  "status" "SaiposConnectionStatus" NOT NULL DEFAULT 'connected',
  "connected_by_team_member_id" TEXT,
  "cursor_updated_at" TIMESTAMP(3),
  "last_sync_at" TIMESTAMP(3),
  "last_error" TEXT,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_saipos_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_saipos_connections_business_id_key"
  ON "business_saipos_connections"("business_id");

CREATE TABLE "saipos_sales" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "saipos_sale_id" TEXT NOT NULL,
  "sale_id" TEXT,
  "membership_id" TEXT,
  "status" "SaiposSaleStatus" NOT NULL,
  "skip_reason" TEXT,
  "amount_cents" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "saipos_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saipos_sales_business_id_saipos_sale_id_key"
  ON "saipos_sales"("business_id", "saipos_sale_id");

CREATE INDEX "saipos_sales_business_id_status_idx"
  ON "saipos_sales"("business_id", "status");

ALTER TABLE "business_saipos_connections"
  ADD CONSTRAINT "business_saipos_connections_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_saipos_connections"
  ADD CONSTRAINT "business_saipos_connections_connected_by_team_member_id_fkey"
  FOREIGN KEY ("connected_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "saipos_sales"
  ADD CONSTRAINT "saipos_sales_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
