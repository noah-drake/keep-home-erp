-- =============================================================================
-- Dashboard server-side compute · public.get_dashboard_metrics(org_id uuid)
--
-- Mirrors app/page.tsx fetchData() card / metric logic:
--
--   mats = materials WHERE organization_id AND is_active IS TRUE
--
--   stock_rollups = view_stock_by_location grouped by (material_id, location_id)
--                   WHERE organization_id AND quantity > 0
--
--   PHANTOM CARD: for each mat NOT IN stock_rollups.material_id:
--                 one row (material_id, default_location_id, qty 0)
--
--   UNION = stock_rollups ∪ phantom_rows  → "union_cards"
--
--   total_qty(mat) = SUM(qty) over union_cards for that material
--
--   threshold(mat) = CASE WHEN is_mrp_enabled THEN COALESCE(reorder_point,0) ELSE 0 END
--   low_stock_count = COUNT mat where total_qty <= threshold
--
--   mrp_item_count = COUNT mat where COALESCE(is_mrp_enabled, false)
--
--   unassigned_items_count = COUNT union_cards rows where location_id IS NULL
--
--   active_locations_count = COUNT locations L for org where EXISTS union_card
--                            with card.location_id = L.id (and location_id not null)
--
--   ghost_locations_count = total org locations - active_locations_count
--
--   total_materials_count = COUNT all materials (any is_active) for org
--       (same as client head count for header + empty registry branch)
--
-- Also returns JSON arrays: locations, materials_active, stock_by_location,
-- units, recent_activity — one round trip for the dashboard.
--
-- SECURITY: SECURITY INVOKER → RLS on underlying tables applies.
-- GRANT to authenticated (and/or service_role as needed).
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_dashboard_metrics (UUID);

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics (org_id UUID)
  RETURNS JSONB
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  SET search_path = public
AS
$$
  WITH mats AS (
         SELECT m.id,
                m.name,
                m.description,
                m.default_location_id,
                m.unit_id,
                m.reorder_point,
                m.is_mrp_enabled,
                m.category_id,
                m.category,
                m.barcode,
                m.is_active,
                m.is_global,
                m.lot_quantity,
                m.organization_id,
                m.specs,
                m.created_at
           FROM public.materials AS m
          WHERE m.organization_id = org_id AND m.is_active IS TRUE ),
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
         SELECT (SELECT COUNT (*)::bigint FROM public.materials AS mn WHERE mn.organization_id = org_id) AS total_materials_count,
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
                                                   CASE WHEN mt.id IS NOT NULL THEN JSONB_BUILD_OBJECT ('name', mt.name) END,
                                                   'locations',
                                                   CASE WHEN ll.id IS NOT NULL THEN JSONB_BUILD_OBJECT ('name', ll.name) END)) AS row_json,
                        im.created_at AS sort_ts
                   FROM public.inventory_movements AS im
                   LEFT JOIN public.materials AS mt ON mt.id = im.material_id
                   LEFT JOIN public.locations AS ll ON ll.id = im.location_id
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
  IS 'Single-round-trip dashboard bundle: pre-computed parity metrics + payloads for SPA.';
