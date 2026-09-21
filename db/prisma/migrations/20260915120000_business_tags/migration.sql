-- CreateTable
CREATE TABLE "business_tags" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_tags" (
    "membership_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "tagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tagged_by_team_member_id" TEXT,

    CONSTRAINT "membership_tags_pkey" PRIMARY KEY ("membership_id","tag_id")
);

-- CreateIndex
CREATE INDEX "business_tags_business_id_idx" ON "business_tags"("business_id");

-- Active tag names are unique per house (archived names can be reused).
CREATE UNIQUE INDEX "business_tags_business_id_name_active_key"
ON "business_tags" ("business_id", lower("name"))
WHERE "archived_at" IS NULL;

-- CreateIndex
CREATE INDEX "membership_tags_tag_id_idx" ON "membership_tags"("tag_id");

-- CreateIndex
CREATE INDEX "membership_tags_tagged_by_team_member_id_idx" ON "membership_tags"("tagged_by_team_member_id");

-- AddForeignKey
ALTER TABLE "business_tags" ADD CONSTRAINT "business_tags_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_tags" ADD CONSTRAINT "membership_tags_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_tags" ADD CONSTRAINT "membership_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "business_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_tags" ADD CONSTRAINT "membership_tags_tagged_by_team_member_id_fkey" FOREIGN KEY ("tagged_by_team_member_id") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
