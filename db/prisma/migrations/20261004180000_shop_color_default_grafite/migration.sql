-- New shops no longer default to the retired August blue.
-- Existing rows keep the color the shop already chose.
ALTER TABLE "Business" ALTER COLUMN "primary_color" SET DEFAULT '#070707';
ALTER TABLE "Business" ALTER COLUMN "primary_color_dark" SET DEFAULT '#070707';
