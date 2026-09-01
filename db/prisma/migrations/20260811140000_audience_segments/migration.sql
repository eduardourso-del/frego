-- CreateTable
CREATE TABLE "audience_segments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audience_segments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "audience_segment_id" TEXT;

-- CreateIndex
CREATE INDEX "audience_segments_business_id_idx" ON "audience_segments"("business_id");

-- CreateIndex
CREATE INDEX "campaigns_audience_segment_id_idx" ON "campaigns"("audience_segment_id");

-- AddForeignKey
ALTER TABLE "audience_segments" ADD CONSTRAINT "audience_segments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_audience_segment_id_fkey" FOREIGN KEY ("audience_segment_id") REFERENCES "audience_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
