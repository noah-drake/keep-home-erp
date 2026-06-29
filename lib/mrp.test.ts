import { describe, it, expect } from 'vitest'
import {
  needsReorder,
  getProcurementList,
  isMissingMasterData,
  buildReorderReceipt,
  type StockRow,
} from './mrp'

/** A fully-configured, well-stocked good; tests override only the fields under test. */
function stockRow(overrides: Partial<StockRow> = {}): StockRow {
  return {
    material_id: 'm1',
    name: 'Olive Oil',
    category: 'food',
    category_id: null,
    current_stock: 10,
    reorder_point: 4,
    lot_quantity: 6,
    default_location_id: 'pantry',
    description: null,
    organization_id: 'org-1',
    unit: 'bottle',
    active: true,
    ...overrides,
  } as StockRow
}

describe('needsReorder', () => {
  it('flags a good at or below its reorder point', () => {
    expect(needsReorder(stockRow({ current_stock: 4, reorder_point: 4 }))).toBe(true)
    expect(needsReorder(stockRow({ current_stock: 2, reorder_point: 4 }))).toBe(true)
  })

  it('leaves a well-stocked good alone', () => {
    expect(needsReorder(stockRow({ current_stock: 10, reorder_point: 4 }))).toBe(false)
  })

  it('ignores goods with MRP disabled (no positive reorder point)', () => {
    expect(needsReorder(stockRow({ current_stock: 0, reorder_point: 0 }))).toBe(false)
    expect(needsReorder(stockRow({ current_stock: 0, reorder_point: null }))).toBe(false)
  })

  it('excludes inactive goods even when low', () => {
    expect(needsReorder(stockRow({ current_stock: 0, active: false }))).toBe(false)
  })

  it('treats null stock as zero so a low item is not missed', () => {
    expect(needsReorder(stockRow({ current_stock: null, reorder_point: 4 }))).toBe(true)
  })
})

describe('getProcurementList', () => {
  it('returns only the goods that need restocking', () => {
    const items = [
      stockRow({ material_id: 'low', current_stock: 1, reorder_point: 4 }),
      stockRow({ material_id: 'ok', current_stock: 9, reorder_point: 4 }),
      stockRow({ material_id: 'no-mrp', current_stock: 0, reorder_point: 0 }),
    ]
    expect(getProcurementList(items).map((i) => i.material_id)).toEqual(['low'])
  })
})

describe('isMissingMasterData', () => {
  it('passes a good with a default location and positive lot quantity', () => {
    expect(isMissingMasterData(stockRow())).toBe(false)
  })

  it('fails when the default location or lot quantity is unusable', () => {
    expect(isMissingMasterData(stockRow({ default_location_id: null }))).toBe(true)
    expect(isMissingMasterData(stockRow({ lot_quantity: null }))).toBe(true)
    expect(isMissingMasterData(stockRow({ lot_quantity: 0 }))).toBe(true)
  })
})

describe('buildReorderReceipt', () => {
  it('builds a one-lot INBOUND into the default location', () => {
    const receipt = buildReorderReceipt(stockRow({ lot_quantity: 6 }), 'org-1')
    expect(receipt).toEqual({
      organization_id: 'org-1',
      material_id: 'm1',
      location_id: 'pantry',
      quantity: 6,
      movement_type: 'INBOUND',
      notes: 'Auto-Receipt via Procurement List',
    })
  })

  it('refuses to build a receipt when master data is incomplete', () => {
    expect(buildReorderReceipt(stockRow({ default_location_id: null }), 'org-1')).toBeNull()
    expect(buildReorderReceipt(stockRow({ lot_quantity: 0 }), 'org-1')).toBeNull()
  })
})
