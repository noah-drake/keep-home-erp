-- =====================================================================
-- Migration: PHASE 2 CUTOVER — repoint the app's read/write surface
--            from legacy public.materials onto the normalized
--            public.org_materials + public.catalog_items tables.
--
-- Pairs with: 20260629130000_split_materials_catalog.sql (Phase 1 backfill).
--
-- DO NOT RUN until the app build that reads the new tables is ready to deploy.
-- This must go live in LOCKSTEP with that deploy.
--
-- KEY INVARIANT (from Phase 1):
--   org_materials.id == legacy materials.id (1:1). So
--   inventory_movements.material_id already resolves to org_materials.id
--   with ZERO data change — this migration only re-declares the FK and
--   re-sources the two views + get_dashboard_metrics.
--
-- WHAT THIS DOES:
--   1. Repoint inventory_movements.material_id FK -> org_materials(id).
--   2. Re-source view_current_stock and view_stock_by_location onto
--      org_materials JOIN catalog_items, preserving the EXACT client-visible
--      column contract (names / order / TYPES).
--   3. CREATE OR REPLACE get_dashboard_metrics with the same JSON shape
--      the dashboard client (app/page.tsx) reads, re-sourced.
--
-- WHAT THIS DOES NOT DO:
--   * Does NOT drop public.materials (kept for dual-read / rollback).
--   * Run in lockstep with the app deploy that reads the new tables.
--
-- COLUMN-CONTRACT FIDELITY:
--   * view_current_stock cols: material_id, name, description, category_id,
--       category, unit, lot_quantity, reorder_point, active, organization_id,
--       default_location_id, current_stock.
--   * view_stock_by_location cols: material_id, material_name, location_id,
--       location_name, organization_id, quantity.
--   * category   = categories.name via category_id join (NOT the enum).
--   * unit       = catalog_items.unit_id raw text passthrough (NO units join).
--   * current_stock = COALESCE(SUM(im.quantity), 0::bigint)  (bigint).
--   * quantity      = SUM(im.quantity)                        (bigint).
--
-- TYPE-IDENTITY WARNING (the reason view_current_stock is DROP+CREATE, not REPLACE):
--   CREATE OR REPLACE VIEW cannot change a column's NAME, ORDER, *or DATA TYPE*
--   (else ERROR 42P16). The LIVE view_current_stock sources lot_quantity and
--   reorder_point from legacy materials, where they are INTEGER. Phase 1 created
--   org_materials.lot_quantity / reorder_point as NUMERIC. Re-sourcing from
--   org_materials therefore changes those two output columns int4 -> numeric,
--   which a CREATE OR REPLACE would REJECT (rolling back the whole txn).
--   We therefore DROP + CREATE view_current_stock and CAST both columns back to
--   ::integer so the client-visible type is byte-identical to the legacy view.
--   The cast is lossless: Phase 1 backfilled these numerics straight from the
--   integer source columns, so every value is a whole number.
--   view_stock_by_location is unaffected (all its column types — uuid, text,
--   uuid, text, uuid, and bigint from SUM(int) — are unchanged), so it stays on
--   CREATE OR REPLACE.
--
-- DEPENDENCY NOTE (why DROP ... CASCADE on view_current_stock is safe):
--   The only DB object that depends on a view here is get_dashboard_metrics,
--   and it reads view_stock_by_location ONLY — NOT view_current_stock. A repo
--   grep shows view_current_stock is referenced solely by app TS files and
--   types/database.types.ts (no SQL view / rule / function / matview depends on
--   it). So the CASCADE drops nothing extra and there is nothing to recreate
--   beyond the view itself. (CASCADE is used defensively; with no SQL dependents
--   a plain DROP would also succeed.)
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Preconditions: Phase 1 must have run; both new tables must exist
--    and inventory_movements must already resolve cleanly to org_materials.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.org_materials') IS NULL
     OR to_regclass('public.catalog_items') IS NULL THEN
    RAISE EXCEPTION 'Phase 1 tables (org_materials/catalog_items) missing; run the split migration first. Aborting.';
  END IF;
END$$;

-- Hard gate: EVERY inventory_movements.material_id already resolves to an
-- org_materials.id. If not, the FK swap below would fail anyway — fail with a
-- clearer message first. (This is the same invariant Phase 1 verified at 4b.)
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM public.inventory_movements im
  WHERE NOT EXISTS (SELECT 1 FROM public.org_materials om WHERE om.id = im.material_id);
  IF bad > 0 THEN
    RAISE EXCEPTION 'Cutover blocked: % inventory_movements rows do not resolve to org_materials.id. Re-run Phase 1 backfill before cutover.', bad;
  END IF;
END$$;

-- Safety check for the lossless ::integer cast in view_current_stock: assert no
-- per-org row carries a fractional lot_quantity / reorder_point. If Phase 1
-- backfilled cleanly from integer sources this is always 0; fail loudly if not,
-- because a silent ::integer truncation would corrupt the column contract.
DO $$
DECLARE bad bigint;
BEGIN
  SELECT count(*) INTO bad
  FROM public.org_materials om
  WHERE (om.lot_quantity  IS NOT NULL AND om.lot_quantity  <> trunc(om.lot_quantity))
     OR (om.reorder_point IS NOT NULL AND om.reorder_point <> trunc(om.reorder_point));
  IF bad > 0 THEN
    RAISE EXCEPTION 'Cutover blocked: % org_materials rows have fractional lot_quantity/reorder_point; the legacy view_current_stock contract is integer and the ::integer cast would truncate. Reconcile these values (or widen the view contract to numeric via a deliberate type change) before cutover.', bad;
  END IF;
END$$;


-- =====================================================================
-- 1. REPOINT THE LEDGER FK: inventory_movements.material_id -> org_materials(id)
-- =====================================================================
-- id values are unchanged (org_materials.id == materials.id), so this is a
-- pure constraint re-declaration with no row updates. Discover the real FK name
-- (don't trust the conventional name blindly), drop it, then add the new one.
DO $$
DECLARE fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel       ON rel.oid = con.conrelid
  JOIN pg_namespace nsp   ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'inventory_movements'
    AND con.contype = 'f'
    AND con.conkey = ARRAY[
          (SELECT attnum FROM pg_attribute
            WHERE attrelid = rel.oid AND attname = 'material_id')
        ]::int2[]
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.inventory_movements DROP CONSTRAINT %I', fk_name);
  END IF;
END$$;

-- Idempotent guard in case the conventional name lingers from a prior partial run.
ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_material_id_fkey;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES public.org_materials(id);


-- =====================================================================
-- 2. VIEWS — re-source onto org_materials + catalog_items, EXACT contract.
-- =====================================================================

-- 2a. view_current_stock ----------------------------------------------
--   DROP + CREATE (NOT REPLACE) because lot_quantity/reorder_point change
--   underlying type int4 -> numeric; casting them back to ::integer below
--   preserves the legacy client-visible column TYPE exactly. See the
--   TYPE-IDENTITY WARNING and DEPENDENCY NOTE in the header for why CASCADE is
--   safe (no SQL object depends on this view; nothing to recreate).
--
--   Live: FROM materials m LEFT JOIN inventory_movements LEFT JOIN categories.
--   Re-sourced: org_materials (policy + ledger id) INNER JOIN catalog_items
--   (identity; every org_materials row has a catalog parent by FK + Phase 1
--   check 4d, so this stays one row per org_materials exactly as the legacy
--   view produced one row per material), LEFT JOIN categories for the name,
--   LEFT JOIN movements for the sum.
DROP VIEW IF EXISTS public.view_current_stock CASCADE;

CREATE VIEW public.view_current_stock AS
SELECT
  om.id                                  AS material_id,
  ci.name                                AS name,
  ci.description                         AS description,
  ci.category_id                         AS category_id,
  cat.name                               AS category,        -- categories.name (NOT the enum)
  ci.unit_id                             AS unit,            -- raw text passthrough (legacy: m.unit_id AS unit)
  om.lot_quantity::integer               AS lot_quantity,    -- cast numeric -> int4 to match legacy view type (42P16)
  om.reorder_point::integer              AS reorder_point,   -- cast numeric -> int4 to match legacy view type (42P16)
  om.is_active                           AS active,
  om.organization_id                     AS organization_id,
  om.default_location_id                 AS default_location_id,
  COALESCE(SUM(im.quantity), 0::bigint)  AS current_stock
FROM public.org_materials om
JOIN public.catalog_items ci            ON ci.id = om.catalog_item_id
LEFT JOIN public.categories cat         ON cat.id = ci.category_id
LEFT JOIN public.inventory_movements im ON im.material_id = om.id
GROUP BY
  om.id, ci.id, cat.name;
  -- GROUP BY om.id covers all om.* outputs (om.id is PK); ci.id covers all ci.*
  -- outputs (ci.id is PK); cat.name is the only non-key projected column.

-- 2b. view_stock_by_location ------------------------------------------
--   Column TYPES are unchanged (uuid, text, uuid, text, uuid, bigint), so
--   CREATE OR REPLACE is valid here and avoids touching get_dashboard_metrics,
--   which depends on this view. Replaced BEFORE the function (§3) so the
--   function's re-create sees the new definition.
--   Live: FROM inventory_movements im JOIN materials m JOIN locations l (inner).
--   Re-sourced: movements INNER JOIN org_materials INNER JOIN catalog_items
--   (for material_name) INNER JOIN locations — same inner-join semantics, so a
--   movement with a NULL/unmatched location_id is excluded exactly as before.
CREATE OR REPLACE VIEW public.view_stock_by_location AS
SELECT
  im.material_id          AS material_id,
  ci.name                 AS material_name,
  im.location_id          AS location_id,
  l.name                  AS location_name,
  im.organization_id      AS organization_id,
  SUM(im.quantity)        AS quantity
FROM public.inventory_movements im
JOIN public.org_materials om ON om.id = im.material_id
JOIN public.catalog_items ci ON ci.id = om.catalog_item_id
JOIN public.locations l      ON l.id = im.location_id
GROUP BY
  im.material_id, ci.name, im.location_id, l.name, im.organization_id;


-- =====================================================================
-- 3. get_dashboard_metrics — re-sourced, IDENTICAL JSON shape.
-- =====================================================================
-- The dashboard client (app/page.tsx) reads exactly these keys (verified):
--   payload.metrics.{total_materials_count, mrp_item_count, low_stock_count,
--                    unassigned_items_count, active_locations_count,
--                    ghost_locations_count}
--   payload.locations[]            (whole location rows; .id/.name used)
--   payload.materials_active[]     -> .id, .name, .unit_id, .reorder_point,
--                                     .is_mrp_enabled, .default_location_id
--   payload.stock_by_location[]    -> .material_id, .location_id, .quantity
--   payload.units[]                -> .id, .name
--   payload.recent_activity[]      -> .id, .created_at, .movement_type,
--                                     .quantity, .materials.name, .locations.name
--
-- Re-sourcing rules applied:
--   * `mats` reads policy from org_materials (om) + identity from catalog_items
--     (ci), keyed by om.organization_id / om.is_active, projecting the SAME 16
--     field names the legacy `to_jsonb(m)` emitted so materials_active keeps
--     key parity:
--       id, name, description, default_location_id, unit_id, reorder_point,
--       is_mrp_enabled, category_id, category, barcode, is_active, is_global,
--       lot_quantity, organization_id, specs, created_at
--     - is_global   := (ci.visibility = 'global')  (legacy boolean column; VALUE
--                       may differ for per-org rows given a private identity —
--                       app/page.tsx does not read is_global, see residual risks)
--     - category    := ci.category                 (material_category enum, as legacy materials.category)
--     - specs       := NULL::jsonb                 (catalog_items carries no specs; key preserved, value NULL)
--     - created_at  := om.created_at               (policy-row creation; NOT byte-exact for legacy NULL-origin rows)
--   * total_materials_count counts the org's ORG_MATERIALS rows (== per-org
--     legacy materials by Phase 1 check 4c).
--   * stock_rollups / j_stock still read view_stock_by_location (re-sourced in §2).
--   * recent-activity name LEFT JOIN now goes org_materials -> catalog_items.
--
-- Keep SECURITY INVOKER + STABLE + search_path + the GRANTs. No DROP — the
-- signature (uuid) -> jsonb is unchanged, so CREATE OR REPLACE is sufficient.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics (org_id UUID)
  RETURNS JSONB
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
AS
$$
  WITH mats AS (
         SELECT om.id                                       AS id,
                ci.name                                     AS name,
                ci.description                              AS description,
                om.default_location_id                      AS default_location_id,
                ci.unit_id                                  AS unit_id,
                om.reorder_point                            AS reorder_point,
                om.is_mrp_enabled                           AS is_mrp_enabled,
                ci.category_id                              AS category_id,
                ci.category                                 AS category,
                ci.barcode                                  AS barcode,
                om.is_active                                AS is_active,
                (ci.visibility = 'global')                  AS is_global,
                om.lot_quantity                             AS lot_quantity,
                om.organization_id                          AS organization_id,
                NULL::jsonb                                 AS specs,
                om.created_at                               AS created_at
           FROM public.org_materials AS om
           JOIN public.catalog_items AS ci ON ci.id = om.catalog_item_id
          WHERE om.organization_id = org_id AND om.is_active IS TRUE ),
       stock_rollups AS (
         SELECT v.material_id,
                v.location_id,
                SUM(GREATEST (COALESCE (v.quantity, 0::NUMERIC), 0::NUMERIC))::NUMERIC AS qty_sum
           FROM public.view_stock_by_location AS v
          WHERE v.organization_id = org_id AND COALESCE (v.quantity, 0) > 0
          GROUP BY v.material_id, v.location_id ),
       mats_with_positive_stock AS (
         SELECT DISTINCT s.material_id
           FROM stock_rollups AS s ),
       phantom_cards AS (
         SELECT m.id AS material_id,
                m.default_location_id AS location_id,
                0::NUMERIC AS qty_sum
           FROM mats AS m
          WHERE NOT EXISTS (
                  SELECT 1
                    FROM mats_with_positive_stock AS h
                   WHERE h.material_id = m.id ) ),
       union_cards AS (
         SELECT s.material_id, s.location_id, s.qty_sum
           FROM stock_rollups AS s
          UNION ALL
         SELECT p.material_id, p.location_id, p.qty_sum
           FROM phantom_cards AS p ),
       totals AS (
         SELECT u.material_id,
                SUM(u.qty_sum)::NUMERIC AS total_qty
           FROM union_cards AS u
          GROUP BY u.material_id ),
       low_stock AS (
         SELECT COUNT (*)::bigint AS c
           FROM mats AS m
           JOIN totals AS t ON t.material_id = m.id
          WHERE t.total_qty <= CASE WHEN COALESCE (m.is_mrp_enabled, FALSE) THEN COALESCE (m.reorder_point, 0)::NUMERIC ELSE 0::NUMERIC END ),
       loc_base AS (
         SELECT l.*
           FROM public.locations AS l
          WHERE l.organization_id = org_id ),
       active_locs AS (
         SELECT l.id
           FROM loc_base AS l
          WHERE EXISTS (
                  SELECT 1
                    FROM union_cards AS c
                   WHERE c.location_id IS NOT NULL AND c.location_id = l.id ) ),
       metrics AS (
         SELECT (SELECT COUNT (*)::bigint FROM public.org_materials AS mn WHERE mn.organization_id = org_id) AS total_materials_count,
                (SELECT COUNT (*)::bigint FROM mats AS mm WHERE COALESCE (mm.is_mrp_enabled, FALSE)) AS mrp_item_count,
                (SELECT COALESCE (c, 0::bigint) FROM low_stock) AS low_stock_count,
                (SELECT COUNT (*)::bigint FROM union_cards AS u WHERE u.location_id IS NULL) AS unassigned_items_count,
                (SELECT COUNT (*)::bigint FROM active_locs) AS active_locations_count,
                (SELECT COUNT (*)::bigint FROM loc_base) - (SELECT COUNT (*)::bigint FROM active_locs) AS ghost_locations_count ),
       j_locations AS (
         SELECT COALESCE (JSONB_AGG (to_jsonb (l) ORDER BY l.name ASC), '[]'::JSONB) AS arr
           FROM loc_base AS l ),
       j_mats AS (
         SELECT COALESCE (JSONB_AGG (to_jsonb (m) ORDER BY m.name ASC), '[]'::JSONB) AS arr
           FROM mats AS m ),
       j_stock AS (
         SELECT COALESCE (JSONB_AGG (to_jsonb (s) ORDER BY s.material_id::TEXT, s.location_id::TEXT),
                          '[]'::JSONB) AS arr
           FROM (SELECT v.material_id,
                        v.location_id,
                        v.material_name,
                        v.location_name,
                        v.organization_id,
                        v.quantity
                   FROM public.view_stock_by_location AS v
                  WHERE v.organization_id = org_id AND COALESCE (v.quantity, 0) > 0) AS s ),
       j_units AS (
         SELECT COALESCE (JSONB_AGG (to_jsonb (u) ORDER BY u.name ASC), '[]'::JSONB) AS arr
           FROM public.units AS u
          WHERE u.organization_id IS NULL OR u.organization_id = org_id ),
       j_activity AS (
         SELECT COALESCE (JSONB_AGG (q.row_json ORDER BY q.sort_ts DESC NULLS LAST), '[]'::JSONB) AS arr
           FROM (SELECT JSONB_STRIP_NULLS(
                                JSONB_BUILD_OBJECT('id', im.id, 'batch_id', im.batch_id, 'created_at', im.created_at,
                                                   'location_id', im.location_id, 'material_id', im.material_id,
                                                   'material_name', im.material_name, 'movement_type', im.movement_type,
                                                   'notes', im.notes, 'organization_id', im.organization_id, 'quantity',
                                                   im.quantity, 'materials',
                                                   CASE WHEN mt.id IS NOT NULL THEN JSONB_BUILD_OBJECT ('name', mci.name) END,
                                                   'locations',
                                                   CASE WHEN ll.id IS NOT NULL THEN JSONB_BUILD_OBJECT ('name', ll.name) END)) AS row_json,
                        im.created_at AS sort_ts
                   FROM public.inventory_movements AS im
                   LEFT JOIN public.org_materials AS mt  ON mt.id = im.material_id
                   LEFT JOIN public.catalog_items AS mci ON mci.id = mt.catalog_item_id
                   LEFT JOIN public.locations AS ll      ON ll.id = im.location_id
                  WHERE im.organization_id = org_id
                  ORDER BY im.created_at DESC NULLS LAST LIMIT 15) AS q)
  SELECT JSONB_BUILD_OBJECT('metrics',
                            (SELECT JSONB_BUILD_OBJECT('total_materials_count', mx.total_materials_count,
                                                       'mrp_item_count', mx.mrp_item_count, 'low_stock_count',
                                                       mx.low_stock_count, 'unassigned_items_count', mx.unassigned_items_count,
                                                       'active_locations_count', mx.active_locations_count,
                                                       'ghost_locations_count', mx.ghost_locations_count) FROM metrics AS mx),
                            'locations', (SELECT jl.arr FROM j_locations jl), 'materials_active', (SELECT jm.arr FROM j_mats jm),
                            'stock_by_location', (SELECT js.arr FROM j_stock js), 'units', (SELECT ju.arr FROM j_units ju),
                            'recent_activity', (SELECT ja.arr FROM j_activity ja));
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics (UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics (UUID) TO service_role;

COMMENT ON FUNCTION public.get_dashboard_metrics (UUID)
  IS 'Single-round-trip dashboard bundle (Phase 2: re-sourced from org_materials + catalog_items; total_materials_count counts org_materials). Pre-computed parity metrics + payloads for SPA.';

COMMIT;
