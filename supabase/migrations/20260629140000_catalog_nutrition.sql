-- =====================================================================
-- Add public nutrition + provenance to the shared catalog.
--
-- Runs AFTER 20260629130000_split_materials_catalog.sql (requires catalog_items).
--
-- WHY a dedicated `nutrition` column and NOT the old `specs` blob:
--   The split migration deliberately omitted `specs` from catalog_items because
--   global rows are world-readable to every authenticated tenant, and `specs`
--   historically could hold commercial data (cost/supplier). Public nutrition
--   facts (Open Food Facts = ODbL, USDA FDC = CC0) are non-sensitive and SHOULD
--   be shared globally — that shared nutrition is exactly what the future
--   MyFitnessPal bridge and the recipe generator read. So we add a narrow,
--   purpose-specific `nutrition jsonb` column instead of reintroducing `specs`.
--
-- Provenance columns let us honor per-source license rules (ODbL requires
-- attribution; CC0 does not) and audit where each row came from.
-- =====================================================================

BEGIN;

ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS nutrition  jsonb,            -- normalized NutritionFacts (per-100g etc.)
  ADD COLUMN IF NOT EXISTS source     text,             -- 'openfoodfacts' | 'usda' | NULL (user-entered)
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS license    text,             -- 'ODbL' | 'CC0' | NULL
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz;

COMMENT ON COLUMN public.catalog_items.nutrition IS
  'Public, shareable nutrition facts (per-100g + per-serving). Safe on the world-readable global catalog. NEVER store cost/supplier/pricing here.';
COMMENT ON COLUMN public.catalog_items.license IS
  'Data license of the source row (e.g. ODbL requires attribution in the UI; CC0 does not).';

COMMIT;
