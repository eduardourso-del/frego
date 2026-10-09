ALTER TABLE "pesquisas" ADD COLUMN "audience_segment_id" TEXT;

CREATE INDEX "pesquisas_audience_segment_id_idx" ON "pesquisas"("audience_segment_id");

ALTER TABLE "pesquisas" ADD CONSTRAINT "pesquisas_audience_segment_id_fkey" FOREIGN KEY ("audience_segment_id") REFERENCES "audience_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
