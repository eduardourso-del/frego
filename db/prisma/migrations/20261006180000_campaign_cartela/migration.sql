-- Cartela: a stamp Campanha may keep its own carimbos.
-- Campaigns that already left draft cannot switch later.
ALTER TABLE "campaigns" ADD COLUMN "cartela" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "campaigns" ADD COLUMN "activated_at" TIMESTAMP(3);

UPDATE "campaigns"
SET "activated_at" = "created_at"
WHERE "status" <> 'draft';
