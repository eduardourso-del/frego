-- Three Planos, the trial clock, and Asaas references on the billing account.

CREATE TYPE "SubscriptionTier" AS ENUM ('starter', 'growth', 'enterprise');

ALTER TABLE "billing_accounts"
  ADD COLUMN "trial_ends_at" TIMESTAMP(3),
  ADD COLUMN "period_ends_at" TIMESTAMP(3),
  ADD COLUMN "past_due_at" TIMESTAMP(3),
  ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paid_replaced_cortesia" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "asaas_customer_id" TEXT,
  ADD COLUMN "asaas_subscription_id" TEXT,
  ADD COLUMN "billing_type" TEXT,
  ADD COLUMN "cortesia_tier" "SubscriptionTier",
  ADD COLUMN "paid_tier" "SubscriptionTier",
  ADD COLUMN "scheduled_tier" "SubscriptionTier",
  ADD COLUMN "pending_upgrade_tier" "SubscriptionTier",
  ADD COLUMN "checkout_tier" "SubscriptionTier";

-- Shops already approved get 7 days of Enterprise from the moment this ships.
UPDATE "billing_accounts" AS ba
SET "trial_ends_at" = NOW() + INTERVAL '7 days'
FROM "businesses" AS b
WHERE ba."business_id" = b."id"
  AND b."status" IN ('trial', 'active')
  AND ba."trial_ends_at" IS NULL;

INSERT INTO "plans" ("id", "tier", "name", "mrr_cents", "created_at")
SELECT 'plan_enterprise', 'enterprise', 'Enterprise', 19900, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "plans" WHERE "tier" = 'enterprise');

UPDATE "plans" SET "mrr_cents" = 11900, "name" = 'Starter' WHERE "tier" = 'starter';
UPDATE "plans" SET "mrr_cents" = 15900, "name" = 'Growth' WHERE "tier" = 'growth';
UPDATE "plans" SET "mrr_cents" = 19900, "name" = 'Enterprise' WHERE "tier" = 'enterprise';
