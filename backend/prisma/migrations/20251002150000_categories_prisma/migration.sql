-- Danh muc (categories) chuyen tu in-memory sang Prisma de ben vung qua restart/redeploy.
-- Giu nguyen API shape cua CategoryService.

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "icon" TEXT,
    "thumbnail" TEXT,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT TRUE,
    "platforms" TEXT[] NOT NULL DEFAULT '{}',
    "applies_to" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_public_id_key" ON "categories"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_is_visible_sort_order_idx" ON "categories"("is_visible", "sort_order");
