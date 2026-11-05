-- Birthday Campanha: Janela is the birthday month, or N days beginning on the birthday.
-- Existing rows stay on the previous fixed span (7 days from the birthday).

CREATE TYPE "BirthdayWindow" AS ENUM ('days', 'month');

ALTER TABLE "campaigns"
  ADD COLUMN "birthday_window" "BirthdayWindow" NOT NULL DEFAULT 'days',
  ADD COLUMN "birthday_window_days" INTEGER NOT NULL DEFAULT 7;
