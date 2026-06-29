/**
 * Hand-written types for the new shared-catalog tables, used by server-side code that talks to
 * them via the untyped service-role client. TEMPORARY: once the migrations are applied and
 * `supabase gen types` is re-run, these tables appear in `database.types.ts` and this file can
 * be deleted in favor of `Tables<'catalog_items'>` / `Tables<'org_materials'>`.
 *
 * Kept UTF-8 + minimal on purpose (the generated `database.types.ts` is UTF-16 and large).
 */

export interface CatalogItemRow {
  id: string
  created_at: string
  name: string
  description: string | null
  barcode: string | null
  category: string | null
  category_id: number | null
  unit_id: string | null
  visibility: 'private' | 'global'
  owner_org_id: string | null
  // Added by 20260629140000_catalog_nutrition.sql:
  nutrition: unknown | null
  source: string | null
  source_url: string | null
  license: string | null
  fetched_at: string | null
}

export interface CatalogItemInsert {
  name: string
  description?: string | null
  barcode?: string | null
  category?: string | null
  category_id?: number | null
  unit_id?: string | null
  visibility: 'private' | 'global'
  owner_org_id?: string | null
  nutrition?: unknown | null
  source?: string | null
  source_url?: string | null
  license?: string | null
  fetched_at?: string | null
}

export interface OrgMaterialRow {
  id: string
  created_at: string
  organization_id: string
  catalog_item_id: string
  reorder_point: number | null
  lot_quantity: number | null
  is_mrp_enabled: boolean
  default_location_id: string | null
  is_active: boolean
}
