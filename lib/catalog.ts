import { supabase } from '@/utils/supabase'
import type { TablesInsert, Enums } from '@/types/database.types'

/**
 * Shared-catalog helper (Phase 2).
 *
 * Identity (what a product IS) lives in `catalog_items`; policy (how an org keeps it) lives in
 * `org_materials`. These helpers turn a flat form payload into the two-table write the app now
 * needs, and back the new "Adopt from global catalog" flow.
 */

/** The product-identity half of a Keep item — written to `catalog_items`. */
export type KeepIdentity = {
  name: string
  description?: string | null
  barcode?: string | null
  category_id?: number | null
  unit_id?: string | null
  category?: Enums<'material_category'> | string | null
}

/** The per-org policy half of a Keep item — written to `org_materials`. */
export type KeepPolicy = {
  default_location_id?: string | null
  reorder_point?: number | null
  lot_quantity?: number | null
  is_mrp_enabled?: boolean
}

/**
 * Resolve the catalog_items id to use for this identity.
 *
 * - If a barcode is supplied, reuse an existing GLOBAL row for it (shared across all Keeps), then
 *   fall back to a PRIVATE row this org already owns.
 * - Otherwise (or if nothing matches) insert a new PRIVATE row owned by this org.
 *
 * Throws on insert error.
 */
export async function resolveCatalogItem(orgId: string, identity: KeepIdentity): Promise<string> {
  const barcode = identity.barcode?.trim() || null

  if (barcode) {
    // 1. Prefer a shared/global catalog row for this barcode.
    const { data: globalRow } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('visibility', 'global')
      .eq('barcode', barcode)
      .limit(1)
      .maybeSingle()
    if (globalRow) return globalRow.id

    // 2. Otherwise reuse a private row this org already owns for the same barcode.
    const { data: ownRow } = await supabase
      .from('catalog_items')
      .select('id')
      .eq('visibility', 'private')
      .eq('owner_org_id', orgId)
      .eq('barcode', barcode)
      .limit(1)
      .maybeSingle()
    if (ownRow) return ownRow.id
  }

  // 3. Nothing matched — mint a new private catalog row owned by this org.
  const insert: TablesInsert<'catalog_items'> = {
    name: identity.name,
    description: identity.description ?? null,
    barcode,
    category: (identity.category as TablesInsert<'catalog_items'>['category']) ?? null,
    category_id: identity.category_id ?? null,
    unit_id: identity.unit_id ?? null,
    visibility: 'private',
    owner_org_id: orgId,
  }

  const { data, error } = await supabase
    .from('catalog_items')
    .insert(insert)
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

/**
 * Adopt an existing catalog item into an org by creating its `org_materials` policy row.
 * Returns the new org_materials id (which is also the inventory key / legacy material id).
 *
 * Throws a friendly Error if the org has already adopted this catalog item (unique violation).
 */
export async function adoptCatalogItem(
  orgId: string,
  catalogItemId: string,
  policy: KeepPolicy
): Promise<string> {
  const insert: TablesInsert<'org_materials'> = {
    organization_id: orgId,
    catalog_item_id: catalogItemId,
    default_location_id: policy.default_location_id ?? null,
    reorder_point: policy.reorder_point ?? null,
    lot_quantity: policy.lot_quantity ?? null,
    is_mrp_enabled: policy.is_mrp_enabled ?? false,
    is_active: true,
  }

  const { data, error } = await supabase
    .from('org_materials')
    .insert(insert)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('This item is already in your Keep.')
    }
    throw error
  }
  return data.id
}

/**
 * Create a brand-new Keep item end to end: resolve (or mint) its catalog identity, then adopt it
 * into the org. Returns the new org_materials id.
 */
export async function createKeepItem(
  orgId: string,
  identity: KeepIdentity,
  policy: KeepPolicy
): Promise<string> {
  const catalogItemId = await resolveCatalogItem(orgId, identity)
  return adoptCatalogItem(orgId, catalogItemId, policy)
}
