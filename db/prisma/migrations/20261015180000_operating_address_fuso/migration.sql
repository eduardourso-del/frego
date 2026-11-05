-- Operating address (UF) and the IANA zone derived from it.
ALTER TABLE "businesses" ADD COLUMN "time_zone" TEXT;

ALTER TABLE "locations" ADD COLUMN "postal_code" TEXT;
ALTER TABLE "locations" ADD COLUMN "street" TEXT;
ALTER TABLE "locations" ADD COLUMN "street_number" TEXT;
ALTER TABLE "locations" ADD COLUMN "complement" TEXT;
ALTER TABLE "locations" ADD COLUMN "neighborhood" TEXT;
ALTER TABLE "locations" ADD COLUMN "city" TEXT;
ALTER TABLE "locations" ADD COLUMN "state" TEXT;
