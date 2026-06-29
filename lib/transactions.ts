import type { TablesInsert } from '@/types/database.types'

/**
 * Pure transaction-engine logic, extracted from the inventory pages so it can be
 * unit-tested in isolation (no React, no Supabase, no DOM). The page components are
 * responsible for fetching data, formatting messages, and persisting the results;
 * everything in here is a deterministic function of its inputs.
 */

export type MovementKind = 'INBOUND' | 'OUTBOUND' | 'TRANSFER'

/** A single editable row in the batch-entry UI. */
export interface TransactionLine {
  id: number
  material_id: string
  location_id: string
  to_location_id: string
  quantity: string
  type: MovementKind
  notes: string
}

/** Minimal shape of a `view_stock_by_location` row needed for validation. */
export interface StockCell {
  material_id: string | null
  location_id: string | null
  quantity: number | null
}

type MovementInsert = TablesInsert<'inventory_movements'>

/** A line only counts toward the batch once it has a good, a source, and a quantity. */
export function isCompleteLine(line: TransactionLine): boolean {
  return Boolean(line.material_id && line.location_id && line.quantity)
}

const cellKey = (materialId: string, locationId: string) => `${materialId}|${locationId}`

/**
 * Sum the quantity each (material, location) cell is drawn down by in this batch.
 * OUTBOUND and TRANSFER both deplete their source location; INBOUND adds and is ignored.
 */
export function projectStockDraws(lines: TransactionLine[]): Map<string, number> {
  const draws = new Map<string, number>()
  for (const line of lines) {
    if (!isCompleteLine(line)) continue
    if (line.type !== 'OUTBOUND' && line.type !== 'TRANSFER') continue
    const qty = parseFloat(line.quantity)
    if (!Number.isFinite(qty)) continue
    const key = cellKey(line.material_id, line.location_id)
    draws.set(key, (draws.get(key) ?? 0) + qty)
  }
  return draws
}

/** The first cell whose batch draws exceed available stock, or null if the batch is valid. */
export interface OverdrawError {
  materialId: string
  locationId: string
  requested: number
  available: number
}

/**
 * Reject any batch that would drive a (material, location) cell negative. Returns the
 * first offending cell so the caller can surface a message, or null when the batch is safe.
 */
export function validateBatch(
  lines: TransactionLine[],
  stock: StockCell[]
): OverdrawError | null {
  const draws = projectStockDraws(lines)

  for (const [key, requested] of draws.entries()) {
    const [materialId, locationId] = key.split('|')
    const available =
      stock.find(
        (s) =>
          String(s.material_id) === materialId &&
          String(s.location_id) === locationId
      )?.quantity ?? 0

    if (requested > available) {
      return { materialId, locationId, requested, available }
    }
  }
  return null
}

/**
 * Translate completed batch lines into append-only ledger rows. A TRANSFER explodes into a
 * paired TRANSFER_OUT (negative at source) and TRANSFER_IN (positive at destination); an
 * OUTBOUND is stored negative and an INBOUND positive. Incomplete lines are skipped.
 */
export function buildMovements(
  lines: TransactionLine[],
  organizationId: string
): MovementInsert[] {
  const movements: MovementInsert[] = []

  for (const line of lines) {
    if (!isCompleteLine(line)) continue
    const qty = parseFloat(line.quantity)
    if (!Number.isFinite(qty)) continue

    if (line.type === 'TRANSFER') {
      movements.push(
        {
          organization_id: organizationId,
          material_id: line.material_id,
          location_id: line.location_id,
          quantity: -qty,
          movement_type: 'TRANSFER_OUT',
          notes: line.notes || 'Transfer Out',
        },
        {
          organization_id: organizationId,
          material_id: line.material_id,
          location_id: line.to_location_id,
          quantity: qty,
          movement_type: 'TRANSFER_IN',
          notes: line.notes || 'Transfer In',
        }
      )
    } else {
      movements.push({
        organization_id: organizationId,
        material_id: line.material_id,
        location_id: line.location_id,
        quantity: line.type === 'OUTBOUND' ? -qty : qty,
        movement_type: line.type,
        notes: line.notes || null,
      })
    }
  }

  return movements
}

/**
 * Pick a sensible default operation and source location for a good, given the locations it
 * currently has stock in. Out of stock anywhere => default to a receipt into its default
 * store; in stock in exactly one place => issue from there; otherwise issue but make the user
 * choose the source. This drives the "auto-switch" behaviour in the batch-entry UI.
 */
export function suggestDefaultsForMaterial(
  stockCells: StockCell[],
  defaultLocationId: string | null | undefined
): { type: MovementKind; locationId: string } {
  const inStock = stockCells.filter((s) => (s.quantity ?? 0) > 0)
  const total = inStock.reduce((sum, s) => sum + (s.quantity ?? 0), 0)

  if (total <= 0) {
    return { type: 'INBOUND', locationId: defaultLocationId ?? '' }
  }
  return {
    type: 'OUTBOUND',
    locationId: inStock.length === 1 ? inStock[0].location_id ?? '' : '',
  }
}

/** Expected vs. counted stock for one good during a physical audit. */
export interface CountEntry {
  material_id: string
  /** System-of-record quantity before the count. */
  expected: number
  /** Raw value the auditor typed; '' or undefined means "not counted, skip". */
  counted: string | undefined
}

/**
 * Turn a cycle-count into the adjustment ledger rows needed to reconcile expected with
 * actual. Only non-zero deltas produce a movement; a surplus is ADJUSTMENT_IN, a shortfall
 * ADJUSTMENT_OUT. Uncounted lines are ignored.
 */
export function buildCountAdjustments(
  entries: CountEntry[],
  locationId: string,
  organizationId: string
): MovementInsert[] {
  const adjustments: MovementInsert[] = []

  for (const entry of entries) {
    if (entry.counted === '' || entry.counted === undefined) continue
    const actual = parseFloat(entry.counted)
    if (!Number.isFinite(actual)) continue

    const delta = actual - entry.expected
    if (delta === 0) continue

    adjustments.push({
      organization_id: organizationId,
      material_id: entry.material_id,
      location_id: locationId,
      quantity: delta,
      movement_type: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      notes: `Audit: Found ${actual}, Expected ${entry.expected}`,
    })
  }

  return adjustments
}
