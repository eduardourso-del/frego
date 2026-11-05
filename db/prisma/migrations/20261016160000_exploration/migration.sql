-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "exploration_visible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "browse_city" TEXT,
ADD COLUMN "browse_state" TEXT,
ADD COLUMN "browse_city_chosen" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "favorites" (
    "customer_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("customer_id","business_id")
);

-- CreateIndex
CREATE INDEX "favorites_business_id_idx" ON "favorites"("business_id");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
