-- Pesquisa: questions an Estabelecimento asks a Cliente. Not a Campanha.

CREATE TYPE "PesquisaStatus" AS ENUM ('draft', 'active', 'archived');
CREATE TYPE "PesquisaBonusKind" AS ENUM ('stamps', 'points', 'cashback');
CREATE TYPE "ConviteStatus" AS ENUM ('open', 'replaced', 'closed', 'answered');
CREATE TYPE "PolegarValue" AS ENUM ('up', 'down');

CREATE TABLE "pesquisas" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "PesquisaStatus" NOT NULL DEFAULT 'draft',
  "note_prompt" TEXT,
  "bonus_enabled" BOOLEAN NOT NULL DEFAULT false,
  "bonus_kind" "PesquisaBonusKind",
  "bonus_quantity" INTEGER,
  "bonus_campaign_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "archived_at" TIMESTAMP(3),
  CONSTRAINT "pesquisas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pesquisa_questions" (
  "id" TEXT NOT NULL,
  "pesquisa_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  CONSTRAINT "pesquisa_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "convites" (
  "id" TEXT NOT NULL,
  "pesquisa_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "earn_transaction_id" TEXT,
  "sale_id" TEXT,
  "status" "ConviteStatus" NOT NULL DEFAULT 'open',
  "snapshot" JSONB NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  CONSTRAINT "convites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "respostas" (
  "id" TEXT NOT NULL,
  "pesquisa_id" TEXT NOT NULL,
  "convite_id" TEXT NOT NULL,
  "membership_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "note" TEXT,
  "bonus_transaction_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "respostas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resposta_answers" (
  "id" TEXT NOT NULL,
  "resposta_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "value" "PolegarValue" NOT NULL,
  CONSTRAINT "resposta_answers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pesquisas_one_open_per_business"
  ON "pesquisas" ("business_id")
  WHERE "status" IN ('draft', 'active');

CREATE INDEX "pesquisas_business_id_status_idx" ON "pesquisas"("business_id", "status");
CREATE INDEX "pesquisas_bonus_campaign_id_idx" ON "pesquisas"("bonus_campaign_id");
CREATE UNIQUE INDEX "pesquisa_questions_pesquisa_id_position_key" ON "pesquisa_questions"("pesquisa_id", "position");
CREATE UNIQUE INDEX "convites_token_key" ON "convites"("token");
CREATE INDEX "convites_pesquisa_id_customer_id_status_idx" ON "convites"("pesquisa_id", "customer_id", "status");
CREATE INDEX "convites_sale_id_idx" ON "convites"("sale_id");
CREATE INDEX "convites_earn_transaction_id_idx" ON "convites"("earn_transaction_id");
CREATE UNIQUE INDEX "respostas_convite_id_key" ON "respostas"("convite_id");
CREATE UNIQUE INDEX "respostas_bonus_transaction_id_key" ON "respostas"("bonus_transaction_id");
CREATE UNIQUE INDEX "respostas_pesquisa_id_customer_id_key" ON "respostas"("pesquisa_id", "customer_id");
CREATE INDEX "respostas_pesquisa_id_created_at_idx" ON "respostas"("pesquisa_id", "created_at");
CREATE UNIQUE INDEX "resposta_answers_resposta_id_position_key" ON "resposta_answers"("resposta_id", "position");

ALTER TABLE "pesquisas" ADD CONSTRAINT "pesquisas_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pesquisas" ADD CONSTRAINT "pesquisas_bonus_campaign_id_fkey" FOREIGN KEY ("bonus_campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pesquisa_questions" ADD CONSTRAINT "pesquisa_questions_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convites" ADD CONSTRAINT "convites_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convites" ADD CONSTRAINT "convites_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "convites" ADD CONSTRAINT "convites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_convite_id_fkey" FOREIGN KEY ("convite_id") REFERENCES "convites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_bonus_transaction_id_fkey" FOREIGN KEY ("bonus_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resposta_answers" ADD CONSTRAINT "resposta_answers_resposta_id_fkey" FOREIGN KEY ("resposta_id") REFERENCES "respostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_whatsapp_connections"
  ADD COLUMN "template_pesquisa_name" TEXT NOT NULL DEFAULT 'frego_earn_pesquisa',
  ADD COLUMN "template_pesquisa_lang" TEXT NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN "template_pesquisa_status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'missing',
  ADD COLUMN "template_pesquisa_id" TEXT,
  ADD COLUMN "template_pesquisa_synced_at" TIMESTAMP(3);
