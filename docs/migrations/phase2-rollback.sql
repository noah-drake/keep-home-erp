-- =====================================================================
-- PHASE 2 ROLLBACK — revert the cutover (20260629150000_phase2_cutover.sql).
--
-- Use ONLY if, after running the cutover SQL, the verification checks look wrong
-- and you want to put the database back the way it was. This is safe because the
-- cutover did NOT drop `materials` (it's still fully populated and 1:1 with
-- org_materials). After this runs, the legacy/pre-cutover app works again.
--
-- DO NOT run this once you've dropped `materials` (the final Phase 2 step) — at
-- that point there's nothing to roll back to.
--
-- This restores the two views + the ledger FK to their pre-cutover (materials-
-- sourced) definitions. To also restore the old dashboard function, re-run
-- docs/sql/02_dashboard_compute.sql (it still contains the original RPC).
-- =====================================================================

BEGIN;

-- 1. Repoint the ledger FK back to materials(id). (ids are identical, no data move.)
ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_material_id_fkey;
ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES public.materials(id);

-- 2. Restore the original views (sourced from materials).
DROP VIEW IF EXISTS public.view_current_stock CASCADE;
CREATE VIEW public.view_current_stock AS
SELECT m.id AS material_id,
       m.name,
       m.description,
       m.category_id,
       c.name AS category,
       m.unit_id AS unit,
       m.lot_quantity,
       m.reorder_point,
       m.is_active AS active,
       m.organization_id,
       m.default_location_id,
       COALESCE(sum(im.quantity), 0::bigint) AS current_stock
FROM public.materials m
LEFT JOIN public.inventory_movements im ON m.id = im.material_id
LEFT JOIN public.categories c ON m.category_id = c.id
GROUP BY m.id, c.name, m.organization_id, m.default_location_id;

CREATE OR REPLACE VIEW public.view_stock_by_location AS
SELECT im.material_id,
       m.name AS material_name,
       im.location_id,
       l.name AS location_name,
       im.organization_id,
       sum(im.quantity) AS quantity
FROM public.inventory_movements im
JOIN public.materials m ON im.material_id = m.id
JOIN public.locations l ON im.location_id = l.id
GROUP BY im.material_id, m.name, im.location_id, l.name, im.organization_id;

COMMIT;

-- 3. (Run separately) restore the original dashboard function:
--    re-run docs/sql/02_dashboard_compute.sql
