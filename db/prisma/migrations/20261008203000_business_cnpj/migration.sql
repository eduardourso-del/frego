-- AlterTable
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_cnpj_key" ON "businesses"("cnpj");
