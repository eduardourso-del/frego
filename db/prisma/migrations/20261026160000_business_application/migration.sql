-- A Cadastro waits here until the owner confirms the e-mail.
CREATE TABLE IF NOT EXISTS "business_applications" (
  "id" TEXT NOT NULL,
  "firebase_uid" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "owner_name" TEXT NOT NULL,
  "business_name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "slogan" TEXT,
  "cnpj" TEXT,
  "primary_color" TEXT NOT NULL DEFAULT '#070707',
  "primary_color_dark" TEXT NOT NULL DEFAULT '#070707',
  "location_name" TEXT NOT NULL,
  "address" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "business_applications_firebase_uid_key" ON "business_applications"("firebase_uid");
CREATE INDEX IF NOT EXISTS "business_applications_email_idx" ON "business_applications"("email");
