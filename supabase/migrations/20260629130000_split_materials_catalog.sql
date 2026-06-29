-- =====================================================================
-- Migration: Split `materials` into `catalog_items` (shared identity)
--            and `org_materials` (per-org policy).
--
-- Pattern: MyFitnessPal item-master.
--   * catalog_items = one canonical row per real-world item (IDENTITY).
--   * org_materials  = per-org policy row; THIS is what the ledger
--                      (inventory_movements.material_id) logically points at.
--
-- STRATEGY: EXPAND-ONLY / NON-BREAKING.
--   * The legacy `materials` table is LEFT INTACT and still queried by the app.
--   * The two existing views are LEFT UNTOUCHED.
--   * inventory_movements is NOT repointed in this migration.
--   * org_materials.id is set EQUAL to the originating per-org materials.id,
--     so inventory_movements.material_id keeps resolving (1:1) with no repoint.
--
-- PHASE 2 (drop materials, rewrite views, app refactor) is documented at the
-- bottom as commented-out DDL and is NOT executed by this file.
--
-- CLASSIFICATION RULE (canonical, applied EVERYWHERE):
--   PER-ORG := organization_id IS NOT NULL   (HAS a real ledger key; gets an
--              org_materials row with id = materials.id, regardless of is_global)
--   GLOBAL  := organization_id IS NULL       (shared catalog identity only;
--              no org_materials row, no ledger key)
--   is_global is treated as an IDENTITY hint only (it may push a per-org row to
--   REUSE a global catalog identity), NEVER as a ledger-ownership signal. This
--   eliminates the org-scoped-is_global ledger-loss gap.
--
-- IDEMPOTENCY: CREATE ... IF NOT EXISTS, deterministic source-id mapping, and
-- guarded inserts make this safe to re-run. The whole thing runs in one
-- transaction. Verification runs BEFORE RLS is enabled so the migration role
-- (auth.uid() NULL) is not filtered by FORCE RLS.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Preconditions / safety
-- ---------------------------------------------------------------------
-- gen_random_uuid() comes from pgcrypto (already present on Supabase).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0a. The material_category enum already exists; we REUSE it. (No CREATE TYPE.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_category') THEN
    RAISE EXCEPTION 'Expected enum type material_category to exist; aborting.';
  END IF;
END$$;

-- 0b. RLS depends entirely on this helper. Assert it exists so a misconfigured
--     target fails fast rather than silently shipping ineffective RLS.
--     (Confirm out-of-band that it is SECURITY DEFINER over organization_members.
--      It is SET-RETURNING (RETURNS SETOF uuid / TABLE), so policies must call it via a
--      subquery -- `col IN (SELECT * FROM public.get_user_org_ids())` -- because Postgres
--      forbids set-returning functions directly in a policy expression.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_org_ids') THEN
    RAISE EXCEPTION 'get_user_org_ids() missing; RLS would be ineffective. Aborting.';
  END IF;
END$$;

-- 0c. PRE-FLIGHT GUARD: ambiguous orphan rows.
--     A row with organization_id IS NULL is destined for the global catalog and
--     gets NO org_materials row (no ledger key). If such a row is nonetheless
--     referenced by inventory_movements, treating it as global would silently
--     orphan that ledger key. Fail loudly and require manual classification.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM public.materials m
  WHERE m.organization_id IS NULL
    AND EXISTS (SELECT 1 FROM public.inventory_movements im WHERE im.material_id = m.id);
  IF bad > 0 THEN
    RAISE EXCEPTION
      'Pre-flight FAIL: % materials with NULL organization_id are referenced by inventory_movements. These cannot be safely classified as global (globals get no ledger key). Classify them manually before migrating.', bad;
  END IF;
END$$;

-- 0d. PRE-FLIGHT GUARD: intra-org duplicate barcodes.
--     Two per-org rows in the same org that share a barcode would resolve to the
--     SAME catalog identity and collide on UNIQUE(organization_id, catalog_item_id).
--     We resolve this by giving each source material its OWN private catalog row
--     (see 3b/3c), preserving every ledger id. This block only REPORTS the
--     situation so the operator is aware that distinct private identities will be
--     created per duplicate (no silent merge, no ledger loss).
DO $$
DECLARE dup bigint;
BEGIN
  SELECT count(*) INTO dup FROM (
    SELECT m.organization_id, m.barcode
    FROM public.materials m
    WHERE m.organization_id IS NOT NULL AND m.barcode IS NOT NULL
    GROUP BY m.organization_id, m.barcode
    HAVING count(*) > 1
  ) d;
  IF dup > 0 THEN
    RAISE NOTICE
      'INFO: % (org, barcode) groups have multiple per-org materials. Each source material will get its OWN private catalog identity to preserve every ledger id (no merge).', dup;
  END IF;
END$$;

-- 0e. PRE-FLIGHT REPORT: global identity merges that would discard differing data.
--     Globals sharing a barcode but differing in name/category/unit are collapsed
--     to one identity in 3a. Surface those so the operator can sign off; the
--     collapse keeps the earliest row and discards the losers' identity fields.
DO $$
DECLARE diverging bigint;
BEGIN
  SELECT count(*) INTO diverging FROM (
    SELECT m.barcode
    FROM public.materials m
    WHERE m.organization_id IS NULL AND m.barcode IS NOT NULL
    GROUP BY m.barcode
    HAVING count(DISTINCT (m.name, m.category, m.unit_id, m.category_id)) > 1
  ) d;
  IF diverging > 0 THEN
    RAISE WARNING
      'REVIEW: % global barcodes map to multiple DISTINCT identities (name/category/unit differ). 3a keeps the earliest and discards the rest. Verify this is intended.', diverging;
  END IF;
END$$;


-- =====================================================================
-- 1. TABLE: catalog_items   (shared IDENTITY)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  name         text NOT NULL,
  description  text,
  barcode      text,
  category     public.material_category,           -- reuse existing enum
  category_id  integer REFERENCES public.categories(id),  -- categories.id is int4 (NOT bigint)
  -- Legacy materials.unit_id is loose TEXT (sometimes a unit NAME, not a units.id), so we keep
  -- it as text with NO FK to avoid backfill type errors / data loss. Normalize to a real uuid
  -- FK in a later cleanup once unit values are reconciled against units.id.
  unit_id      text,
  -- specs intentionally EXCLUDED from the shared identity row. Commercially
  -- sensitive per-relationship data (cost/supplier/pricing) must NOT live on a
  -- world-readable global row. Per-org policy data belongs on org_materials or a
  -- dedicated org-scoped pricing table. See SECURITY note below.
  -- visibility replaces the old boolean `is_global`:
  visibility   text NOT NULL DEFAULT 'private'
                 CHECK (visibility IN ('private','global')),
  -- provenance: which org authored this identity row. NULL for seeded globals.
  owner_org_id uuid REFERENCES public.organizations(id),

  -- A private item must be owned by an org; a global item must NOT be (seeded).
  CONSTRAINT catalog_items_owner_visibility_chk CHECK (
    (visibility = 'private' AND owner_org_id IS NOT NULL)
    OR (visibility = 'global' AND owner_org_id IS NULL)
  )
);

COMMENT ON TABLE  public.catalog_items IS
  'Shared item identity (name/barcode/category/unit). One canonical row per real-world item. visibility=global is the shared catalog; visibility=private is org-authored. NO cost/supplier/pricing data here -- global rows are world-readable to all authenticated users.';
COMMENT ON COLUMN public.catalog_items.visibility   IS 'private | global. Replaces legacy materials.is_global.';
COMMENT ON COLUMN public.catalog_items.owner_org_id IS 'Authoring org for private rows; NULL for seeded global rows. Treat as immutable provenance (see update trigger).';

-- Partial unique on global barcodes: dedupe the shared catalog by barcode.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_global_barcode_uidx
  ON public.catalog_items (barcode)
  WHERE visibility = 'global' AND barcode IS NOT NULL;

-- One private identity per (owner_org_id, barcode): backs the resolver's
-- deterministic lookup and prevents accidental duplicate private rows.
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_private_owner_barcode_uidx
  ON public.catalog_items (owner_org_id, barcode)
  WHERE visibility = 'private' AND barcode IS NOT NULL;

-- Helpful lookup indexes for backfill + runtime.
CREATE INDEX IF NOT EXISTS catalog_items_owner_org_idx   ON public.catalog_items (owner_org_id);
CREATE INDEX IF NOT EXISTS catalog_items_barcode_idx     ON public.catalog_items (barcode);
CREATE INDEX IF NOT EXISTS catalog_items_category_id_idx ON public.catalog_items (category_id);

-- TEMP provenance column used ONLY during backfill to build an exact 1:1 map
-- from a source materials row to the private catalog row created for it. Dropped
-- before COMMIT. IF NOT EXISTS makes re-runs safe.
ALTER TABLE public.catalog_items
  ADD COLUMN IF NOT EXISTS source_material_id uuid;


-- =====================================================================
-- 2. TABLE: org_materials   (per-org POLICY; ledger target)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.org_materials (
  -- During backfill we set id = legacy materials.id so
  -- inventory_movements.material_id keeps resolving with no repoint. The default
  -- is for FUTURE app-created rows only; backfill always supplies id explicitly.
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id),
  catalog_item_id     uuid NOT NULL REFERENCES public.catalog_items(id),
  reorder_point       numeric,
  lot_quantity        numeric,
  is_mrp_enabled      boolean NOT NULL DEFAULT false,
  -- NULLABLE at DB level (legacy rows may lack it). "required-on-adopt" is
  -- enforced in the app form and the optional trigger documented in the guide.
  default_location_id uuid REFERENCES public.locations(id),
  is_active           boolean NOT NULL DEFAULT true,

  -- One policy row per (org, identity). Because backfill creates a distinct
  -- private identity per source material, intra-org duplicate barcodes do NOT
  -- collide here and every ledger id is preserved.
  CONSTRAINT org_materials_org_catalog_uniq UNIQUE (organization_id, catalog_item_id)
);

COMMENT ON TABLE  public.org_materials IS
  'Per-org policy for a catalog item (reorder point, lot qty, MRP, default location, active). org_materials.id == legacy materials.id for backfilled rows so inventory_movements.material_id stays valid.';
COMMENT ON COLUMN public.org_materials.default_location_id IS
  'Nullable in DB (legacy). App + optional trigger enforce non-null when a catalog item is adopted.';

CREATE INDEX IF NOT EXISTS org_materials_org_idx          ON public.org_materials (organization_id);
CREATE INDEX IF NOT EXISTS org_materials_catalog_item_idx ON public.org_materials (catalog_item_id);
CREATE INDEX IF NOT EXISTS org_materials_active_idx       ON public.org_materials (organization_id, is_active);


-- =====================================================================
-- 3. BACKFILL
-- =====================================================================
-- Canonical classification (see header):
--   GLOBAL  := organization_id IS NULL
--   PER-ORG := organization_id IS NOT NULL   (regardless of is_global)
-- is_global only influences WHICH catalog identity a per-org row reuses.

-- ---------------------------------------------------------------------
-- 3a. GLOBAL materials -> catalog_items (visibility=global), DEDUPED by barcode.
-- ---------------------------------------------------------------------
-- 3a-i. Globals WITH a barcode: pick ONE canonical row per barcode (earliest
--       created_at, then smallest id). NOT EXISTS guard (instead of ON CONFLICT)
--       avoids fragile partial-index arbiter inference and is fully re-runnable.
WITH global_src AS (
  SELECT m.*
  FROM public.materials m
  WHERE m.organization_id IS NULL
),
global_with_barcode AS (
  SELECT DISTINCT ON (barcode) *
  FROM global_src
  WHERE barcode IS NOT NULL
  ORDER BY barcode, created_at NULLS LAST, id
)
INSERT INTO public.catalog_items
  (id, created_at, name, description, barcode, category, category_id, unit_id, visibility, owner_org_id)
SELECT
  gen_random_uuid(),          -- new identity id; globals are NOT the ledger key
  COALESCE(gb.created_at, now()),
  gb.name, gb.description, gb.barcode, gb.category, gb.category_id, gb.unit_id,
  'global', NULL
FROM global_with_barcode gb
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_items c
  WHERE c.visibility = 'global' AND c.barcode = gb.barcode
);

-- 3a-ii. Globals WITHOUT a barcode: no natural key. Dedupe WITHIN the statement
--        by identity signature (DISTINCT ON), so at most one row per signature is
--        inserted per run regardless of snapshot timing; NOT EXISTS guards re-runs.
WITH global_no_barcode AS (
  SELECT DISTINCT ON (name, category, unit_id, category_id) *
  FROM public.materials
  WHERE organization_id IS NULL AND barcode IS NULL
  ORDER BY name, category, unit_id, category_id, created_at NULLS LAST, id
)
INSERT INTO public.catalog_items
  (id, created_at, name, description, barcode, category, category_id, unit_id, visibility, owner_org_id)
SELECT
  gen_random_uuid(),
  COALESCE(g.created_at, now()),
  g.name, g.description, NULL, g.category, g.category_id, g.unit_id,
  'global', NULL
FROM global_no_barcode g
WHERE NOT EXISTS (
  SELECT 1 FROM public.catalog_items c
  WHERE c.visibility = 'global'
    AND c.barcode IS NULL
    AND c.name = g.name
    AND c.category    IS NOT DISTINCT FROM g.category
    AND c.unit_id     IS NOT DISTINCT FROM g.unit_id
    AND c.category_id IS NOT DISTINCT FROM g.category_id
);

-- ---------------------------------------------------------------------
-- 3b. PER-ORG materials -> create a PRIVATE catalog identity per source material,
--     UNLESS the row is barcoded and a matching GLOBAL identity exists (then we
--     reuse the global identity in 3c and create no private row here).
-- ---------------------------------------------------------------------
-- KEY DESIGN: to preserve EVERY ledger id (org_materials.id = materials.id) we
-- must keep (organization_id, catalog_item_id) distinct per source material.
-- Therefore we create ONE private catalog row PER source material that needs a
-- private identity (no (org,barcode) dedupe), tagging each with source_material_id
-- for an exact 1:1 map. This handles intra-org duplicate barcodes without
-- collision and without merging distinct ledger rows.
INSERT INTO public.catalog_items
  (id, created_at, name, description, barcode, category, category_id, unit_id,
   visibility, owner_org_id, source_material_id)
SELECT
  gen_random_uuid(),
  COALESCE(m.created_at, now()),
  m.name, m.description, m.barcode, m.category, m.category_id, m.unit_id,
  'private', m.organization_id, m.id
FROM public.materials m
WHERE m.organization_id IS NOT NULL
  -- skip rows that will REUSE a global identity (barcoded + matching global)
  AND NOT (
    m.barcode IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.catalog_items c
      WHERE c.visibility = 'global' AND c.barcode = m.barcode
    )
  )
  -- idempotency: skip materials whose private identity already exists
  AND NOT EXISTS (
    SELECT 1 FROM public.catalog_items c WHERE c.source_material_id = m.id
  );

-- ---------------------------------------------------------------------
-- 3c. INSERT org_materials, id = materials.id  (THE ledger preservation step).
-- ---------------------------------------------------------------------
-- Resolve catalog_item_id per per-org material:
--   1) barcoded + matching GLOBAL identity -> reuse the global identity
--   2) otherwise -> the private identity created for THIS material in 3b
--      (matched by source_material_id; exact 1:1, deterministic, re-run safe)
INSERT INTO public.org_materials
  (id, created_at, organization_id, catalog_item_id,
   reorder_point, lot_quantity, is_mrp_enabled, default_location_id, is_active)
SELECT
  m.id,                                   -- <<< id = legacy materials.id (1:1)
  COALESCE(m.created_at, now()),
  m.organization_id,
  resolved.catalog_item_id,
  m.reorder_point,
  m.lot_quantity,
  COALESCE(m.is_mrp_enabled, false),
  m.default_location_id,
  COALESCE(m.is_active, true)
FROM public.materials m
JOIN LATERAL (
  SELECT
    CASE
      WHEN m.barcode IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.catalog_items c
             WHERE c.visibility = 'global' AND c.barcode = m.barcode)
        THEN (SELECT c.id FROM public.catalog_items c
              WHERE c.visibility = 'global' AND c.barcode = m.barcode
              ORDER BY c.id
              LIMIT 1)
      ELSE (SELECT c.id FROM public.catalog_items c
            WHERE c.source_material_id = m.id
            ORDER BY c.id
            LIMIT 1)
    END AS catalog_item_id
) resolved ON TRUE
WHERE m.organization_id IS NOT NULL
  AND resolved.catalog_item_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;   -- idempotent re-run; id is the PK

-- ---------------------------------------------------------------------
-- 3d. Drop the temporary provenance column now that the map is consumed.
-- ---------------------------------------------------------------------
ALTER TABLE public.catalog_items DROP COLUMN IF EXISTS source_material_id;


-- =====================================================================
-- 4. VERIFICATION  (BEFORE RLS so the migration role is not filtered)
--    DO blocks hard-fail (roll back); SELECTs print diagnostics.
-- =====================================================================
-- 4a. LEDGER COVERAGE (authoritative, predicate-independent invariant):
--     every per-org material (organization_id IS NOT NULL) has an org_materials
--     row with id = materials.id. No is_global term -- cannot be fooled by the
--     insert predicate.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM public.materials m
  WHERE m.organization_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.org_materials om WHERE om.id = m.id);
  IF bad > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % per-org materials (organization_id NOT NULL) have no org_materials row.', bad;
  END IF;
END$$;

-- 4b. LEDGER INTEGRITY HARD GATE: every inventory_movements.material_id that
--     references a PER-ORG material MUST resolve to an org_materials.id.
--     A movement pointing at a NULL-org (global) material is a real defect here
--     (globals have no ledger key); pre-flight 0c already blocked that case, so
--     ANY unresolved movement fails the migration.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM public.inventory_movements im
  WHERE NOT EXISTS (SELECT 1 FROM public.org_materials om WHERE om.id = im.material_id);
  IF bad > 0 THEN
    RAISE EXCEPTION 'Ledger integrity FAIL: % inventory_movements rows have no matching org_materials.id.', bad;
  END IF;
END$$;

-- 4c. PARITY anchored on the predicate-independent invariant: count of per-org
--     materials (organization_id NOT NULL) == count of org_materials.
DO $$
DECLARE per_org_count bigint; om_count bigint;
BEGIN
  SELECT count(*) INTO per_org_count
  FROM public.materials WHERE organization_id IS NOT NULL;
  SELECT count(*) INTO om_count FROM public.org_materials;
  RAISE NOTICE 'per-org materials (org_id NOT NULL) = %, org_materials = %', per_org_count, om_count;
  IF per_org_count <> om_count THEN
    RAISE EXCEPTION 'PARITY FAIL: per-org materials (%) <> org_materials (%).', per_org_count, om_count;
  END IF;
END$$;

-- 4d. No org_materials orphan vs catalog_items (FK guarantees; verify anyway).
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM public.org_materials om
  WHERE NOT EXISTS (SELECT 1 FROM public.catalog_items c WHERE c.id = om.catalog_item_id);
  IF bad > 0 THEN
    RAISE EXCEPTION 'org_materials has % rows with no catalog_items parent.', bad;
  END IF;
END$$;

-- 4e. No global barcode duplicates (partial unique enforces; verify).
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad FROM (
    SELECT barcode FROM public.catalog_items
    WHERE visibility = 'global' AND barcode IS NOT NULL
    GROUP BY barcode HAVING count(*) > 1
  ) d;
  IF bad > 0 THEN
    RAISE EXCEPTION 'Found % duplicated global barcodes in catalog_items.', bad;
  END IF;
END$$;

-- 4f. No org_materials uses a PRIVATE catalog row owned by a DIFFERENT org.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM public.org_materials om
  JOIN public.catalog_items c ON c.id = om.catalog_item_id
  WHERE c.visibility = 'private'
    AND c.owner_org_id <> om.organization_id;
  IF bad > 0 THEN
    RAISE EXCEPTION '% org_materials rows reference a foreign-org private catalog identity.', bad;
  END IF;
END$$;

-- 4g. Diagnostic SELECTs (non-failing) for the operator's log.
SELECT 'per_org_materials' AS metric, count(*) AS value
  FROM public.materials WHERE organization_id IS NOT NULL
UNION ALL
SELECT 'org_materials', count(*) FROM public.org_materials
UNION ALL
SELECT 'catalog_items_global', count(*) FROM public.catalog_items WHERE visibility = 'global'
UNION ALL
SELECT 'catalog_items_private', count(*) FROM public.catalog_items WHERE visibility = 'private';


-- =====================================================================
-- 5. ROW-LEVEL SECURITY  (enabled AFTER verification)
-- =====================================================================
-- Enabling RLS on both new tables is MANDATORY. An un-RLS catalog table holding
-- private (owner_org_id) rows would leak cross-tenant data. We rely on the
-- existing Supabase helper get_user_org_ids() (set-returning; called via subquery, see 0b).
-- service_role bypasses RLS for server-side global-catalog curation/seeding.

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_materials ENABLE ROW LEVEL SECURITY;
-- FORCE so even the table owner is subject to policies (defense in depth).
ALTER TABLE public.catalog_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.org_materials FORCE ROW LEVEL SECURITY;

-- ---- catalog_items policies -----------------------------------------
DROP POLICY IF EXISTS catalog_items_select       ON public.catalog_items;
DROP POLICY IF EXISTS catalog_items_insert_owned ON public.catalog_items;
DROP POLICY IF EXISTS catalog_items_update_owned ON public.catalog_items;
DROP POLICY IF EXISTS catalog_items_delete_owned ON public.catalog_items;

-- SELECT: global rows visible to all authenticated; private only to owning org.
CREATE POLICY catalog_items_select
  ON public.catalog_items
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'global'
    OR owner_org_id IN (SELECT * FROM public.get_user_org_ids())
  );

-- INSERT: members may only create a PRIVATE row owned by one of their orgs.
-- Global inserts/curation run as service_role (bypasses RLS).
CREATE POLICY catalog_items_insert_owned
  ON public.catalog_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    visibility = 'private'
    AND owner_org_id IN (SELECT * FROM public.get_user_org_ids())
  );

-- UPDATE: only private rows owned by a user's org; cannot flip to global.
-- (owner_org_id immutability is enforced by trigger below, since WITH CHECK
--  cannot reference OLD.)
CREATE POLICY catalog_items_update_owned
  ON public.catalog_items
  FOR UPDATE
  TO authenticated
  USING (
    visibility = 'private'
    AND owner_org_id IN (SELECT * FROM public.get_user_org_ids())
  )
  WITH CHECK (
    visibility = 'private'
    AND owner_org_id IN (SELECT * FROM public.get_user_org_ids())
  );

-- DELETE: only private rows owned by a user's org.
CREATE POLICY catalog_items_delete_owned
  ON public.catalog_items
  FOR DELETE
  TO authenticated
  USING (
    visibility = 'private'
    AND owner_org_id IN (SELECT * FROM public.get_user_org_ids())
  );

-- owner_org_id is immutable provenance: block any attempt to reassign it
-- (closes the multi-org-user ownership-migration path).
CREATE OR REPLACE FUNCTION public.catalog_items_lock_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_org_id IS DISTINCT FROM OLD.owner_org_id THEN
    RAISE EXCEPTION 'catalog_items.owner_org_id is immutable (id=%).', OLD.id;
  END IF;
  IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    RAISE EXCEPTION 'catalog_items.visibility is immutable (id=%).', OLD.id;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_catalog_items_lock_owner ON public.catalog_items;
CREATE TRIGGER trg_catalog_items_lock_owner
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.catalog_items_lock_owner();

-- ---- org_materials policies -----------------------------------------
DROP POLICY IF EXISTS org_materials_select ON public.org_materials;
DROP POLICY IF EXISTS org_materials_insert ON public.org_materials;
DROP POLICY IF EXISTS org_materials_update ON public.org_materials;
DROP POLICY IF EXISTS org_materials_delete ON public.org_materials;

CREATE POLICY org_materials_select
  ON public.org_materials
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT * FROM public.get_user_org_ids()));

-- INSERT: org-scoped AND the catalog_item must be one the user may attach:
-- either global, or a private identity owned by the SAME org. This closes the
-- cross-tenant leak where org A attaches org B's private identity and then reads
-- B's name/specs back through a join/view.
CREATE POLICY org_materials_insert
  ON public.org_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT * FROM public.get_user_org_ids())
    AND EXISTS (
      SELECT 1 FROM public.catalog_items c
      WHERE c.id = catalog_item_id
        AND (c.visibility = 'global' OR c.owner_org_id = org_materials.organization_id)
    )
  );

CREATE POLICY org_materials_update
  ON public.org_materials
  FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT * FROM public.get_user_org_ids()))
  WITH CHECK (
    organization_id IN (SELECT * FROM public.get_user_org_ids())
    AND EXISTS (
      SELECT 1 FROM public.catalog_items c
      WHERE c.id = catalog_item_id
        AND (c.visibility = 'global' OR c.owner_org_id = org_materials.organization_id)
    )
  );

CREATE POLICY org_materials_delete
  ON public.org_materials
  FOR DELETE
  TO authenticated
  USING (organization_id IN (SELECT * FROM public.get_user_org_ids()));


COMMIT;


-- =====================================================================
-- =====================  PHASE 2  (DO NOT RUN NOW)  ====================
-- =====================================================================
-- Intentionally COMMENTED OUT. This is the separate, breaking migration that
-- runs AFTER the app is refactored to read catalog_items + org_materials and the
-- new views. Run only once the app no longer references public.materials.
--
-- ---------------------------------------------------------------------
-- PHASE 2, STEP 1: Repoint the ledger FK explicitly (id values unchanged, so no
--                  data update is needed; only re-declare the FK).
-- ---------------------------------------------------------------------
-- BEGIN;
-- ALTER TABLE public.inventory_movements
--   DROP CONSTRAINT IF EXISTS inventory_movements_material_id_fkey;
-- ALTER TABLE public.inventory_movements
--   ADD CONSTRAINT inventory_movements_material_id_fkey
--   FOREIGN KEY (material_id) REFERENCES public.org_materials(id);
-- COMMIT;
--
-- ---------------------------------------------------------------------
-- PHASE 2, STEP 2: Rewrite the two views to read from the NEW tables while
--                  PRESERVING THE EXACT COLUMN CONTRACT (names, order, types).
-- ---------------------------------------------------------------------
-- These reproduce the LIVE view definitions exactly (verified against pg_get_viewdef),
-- just re-sourced from org_materials + catalog_items. Key fidelity points:
--   * category = categories.name via category_id join (NOT the material_category enum)
--   * unit     = catalog_items.unit_id passed through raw (loose text; NO units join)
--   * current_stock / quantity = SUM of int quantities (bigint), inner joins where the
--     legacy view used inner joins.
--
-- view_current_stock (cols: material_id, name, description, category_id, category, unit,
--                      lot_quantity, reorder_point, active, organization_id,
--                      default_location_id, current_stock)
-- CREATE OR REPLACE VIEW public.view_current_stock AS
-- SELECT
--   om.id                                  AS material_id,
--   ci.name                                AS name,
--   ci.description                         AS description,
--   ci.category_id                         AS category_id,
--   cat.name                               AS category,        -- categories.name (NOT the enum)
--   ci.unit_id                             AS unit,            -- raw text passthrough (matches legacy m.unit_id AS unit)
--   om.lot_quantity                        AS lot_quantity,
--   om.reorder_point                       AS reorder_point,
--   om.is_active                           AS active,
--   om.organization_id                     AS organization_id,
--   om.default_location_id                 AS default_location_id,
--   COALESCE(SUM(im.quantity), 0::bigint)  AS current_stock
-- FROM public.org_materials om
-- JOIN public.catalog_items ci    ON ci.id = om.catalog_item_id
-- LEFT JOIN public.categories cat ON cat.id = ci.category_id
-- LEFT JOIN public.inventory_movements im ON im.material_id = om.id
-- GROUP BY om.id, ci.id, cat.name;
--
-- view_stock_by_location (cols: material_id, material_name, location_id, location_name,
--                         organization_id, quantity) -- inner joins, like the live view
-- CREATE OR REPLACE VIEW public.view_stock_by_location AS
-- SELECT
--   im.material_id          AS material_id,
--   ci.name                 AS material_name,
--   im.location_id          AS location_id,
--   l.name                  AS location_name,
--   im.organization_id      AS organization_id,
--   SUM(im.quantity)        AS quantity
-- FROM public.inventory_movements im
-- JOIN public.org_materials om ON om.id = im.material_id
-- JOIN public.catalog_items ci ON ci.id = om.catalog_item_id
-- JOIN public.locations l      ON l.id = im.location_id
-- GROUP BY im.material_id, ci.name, im.location_id, l.name, im.organization_id;
--
-- ---------------------------------------------------------------------
-- PHASE 2, STEP 2b: Rewrite get_dashboard_metrics (docs/sql/02_dashboard_compute.sql).
--   Its `mats` CTE selects FROM public.materials and `to_jsonb(m)` builds the
--   materials_active payload; the recent-activity feed LEFT JOINs materials for the name.
--   Re-source `mats` from org_materials om JOIN catalog_items ci (mapping om policy +
--   ci identity into the same field names the client reads: id, name, unit_id,
--   reorder_point, is_mrp_enabled, default_location_id, category, ...), and change the
--   activity LEFT JOIN to org_materials -> catalog_items for the name. Keep total_materials_count
--   counting the org's org_materials rows.
--
-- ---------------------------------------------------------------------
-- PHASE 2, STEP 3: Drop the legacy table (only after app + views cut over).
-- ---------------------------------------------------------------------
-- DROP TABLE public.materials;   -- requires the views above no longer depend on it.
-- =====================================================================
