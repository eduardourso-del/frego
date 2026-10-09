-- CreateEnum
CREATE TYPE "PesquisaBonusMode" AS ENUM ('fixed', 'double');

-- AlterTable
ALTER TABLE "pesquisas" ADD COLUMN "bonus_mode" "PesquisaBonusMode" NOT NULL DEFAULT 'fixed';
