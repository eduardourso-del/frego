-- AlterTable
ALTER TABLE "memberships" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "memberships_customer_id_is_favorite_idx" ON "memberships"("customer_id", "is_favorite");
