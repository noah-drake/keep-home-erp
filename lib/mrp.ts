import type { Tables, TablesInsert } from '@/types/database.types'

/**
 * Pure Material Requirements Planning (reorder) logic, extracted from the shopping-list page.
 * Decides which goods need restocking and shapes the auto-receipt that replenishes them,
 * with no React/Supabase coupling so it can be unit-tested directly.
 */

/** A row from the `view_current_stock` view (current_stock, reorder_point, etc.). */
export type StockRow = Tables<'view_current_stock'>

/**
 * A good needs reordering when it is active, has a positive reorder point configured (MRP
 * enabled), and its on-hand quantity has fallen to or below that point. Nulls from the view
 * are treated as zero so a half-configured item never silently slips onto the list.
 */
export function needsReorder(item: StockRow): boolean {
  const stock = item.current_stock ?? 0
  const reorder = item.reorder_point ?? 0
  return item.active !== false && reorder > 0 && stock <= reorder
}

/** All goods currently below their reorder point. */
export function getProcurementList(items: StockRow[]): StockRow[] {
  return items.filter(needsReorder)
}

/**
 * An item can't be auto-received until it has somewhere to land (default location) and a
 * positive lot quantity to receive. The UI uses this to gate the one-click "Receive" button.
 */
export function isMissingMasterData(item: StockRow): boolean {
  return !item.default_location_id || !item.lot_quantity || item.lot_quantity <= 0
}

/**
 * Build the single INBOUND ledger row that replenishes a good by one lot into its default
 * location. Returns null when master data is incomplete, so the caller can refuse rather
 * than write a malformed movement.
 */
export function buildReorderReceipt(
  item: StockRow,
  organizationId: string
): TablesInsert<'inventory_movements'> | null {
  if (isMissingMasterData(item) || !item.material_id) return null

  return {
    organization_id: organizationId,
    material_id: item.material_id,
    location_id: item.default_location_id!,
    quantity: item.lot_quantity!,
    movement_type: 'INBOUND',
    notes: 'Auto-Receipt via Procurement List',
  }
}
