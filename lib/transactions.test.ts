import { describe, it, expect } from 'vitest'
import {
  isCompleteLine,
  projectStockDraws,
  validateBatch,
  buildMovements,
  suggestDefaultsForMaterial,
  buildCountAdjustments,
  type TransactionLine,
  type StockCell,
} from './transactions'

const ORG = 'org-1'

/** Build a transaction line with sane defaults so each test only states what it cares about. */
function line(overrides: Partial<TransactionLine> = {}): TransactionLine {
  return {
    id: 1,
    material_id: 'm1',
    location_id: 'l1',
    to_location_id: '',
    quantity: '5',
    type: 'OUTBOUND',
    notes: '',
    ...overrides,
  }
}

describe('isCompleteLine', () => {
  it('requires a good, a location, and a quantity', () => {
    expect(isCompleteLine(line())).toBe(true)
    expect(isCompleteLine(line({ material_id: '' }))).toBe(false)
    expect(isCompleteLine(line({ location_id: '' }))).toBe(false)
    expect(isCompleteLine(line({ quantity: '' }))).toBe(false)
  })
})

describe('projectStockDraws', () => {
  it('sums draws from OUTBOUND and TRANSFER per material+location, ignoring INBOUND', () => {
    const draws = projectStockDraws([
      line({ id: 1, type: 'OUTBOUND', quantity: '3' }),
      line({ id: 2, type: 'TRANSFER', quantity: '2', to_location_id: 'l2' }),
      line({ id: 3, type: 'INBOUND', quantity: '99' }),
    ])
    expect(draws.get('m1|l1')).toBe(5)
    expect(draws.size).toBe(1)
  })

  it('skips incomplete lines and non-numeric quantities', () => {
    const draws = projectStockDraws([
      line({ quantity: '' }),
      line({ quantity: 'abc' }),
    ])
    expect(draws.size).toBe(0)
  })
})

describe('validateBatch', () => {
  const stock: StockCell[] = [{ material_id: 'm1', location_id: 'l1', quantity: 10 }]

  it('passes when draws stay within available stock', () => {
    expect(validateBatch([line({ quantity: '10' })], stock)).toBeNull()
  })

  it('flags the offending cell when a draw exceeds stock', () => {
    const err = validateBatch([line({ quantity: '11' })], stock)
    expect(err).toEqual({
      materialId: 'm1',
      locationId: 'l1',
      requested: 11,
      available: 10,
    })
  })

  it('aggregates multiple lines on the same cell before comparing', () => {
    const err = validateBatch(
      [line({ id: 1, quantity: '6' }), line({ id: 2, quantity: '6' })],
      stock
    )
    expect(err?.requested).toBe(12)
  })

  it('treats a cell with no stock row as zero available', () => {
    const err = validateBatch([line({ location_id: 'l-empty', quantity: '1' })], stock)
    expect(err?.available).toBe(0)
  })
})

describe('buildMovements', () => {
  it('stores OUTBOUND as a negative quantity and INBOUND as positive', () => {
    const out = buildMovements([line({ type: 'OUTBOUND', quantity: '4' })], ORG)
    expect(out).toEqual([
      {
        organization_id: ORG,
        material_id: 'm1',
        location_id: 'l1',
        quantity: -4,
        movement_type: 'OUTBOUND',
        notes: null,
      },
    ])

    const inb = buildMovements([line({ type: 'INBOUND', quantity: '4' })], ORG)
    expect(inb[0].quantity).toBe(4)
    expect(inb[0].movement_type).toBe('INBOUND')
  })

  it('explodes a TRANSFER into a paired OUT (negative) and IN (positive)', () => {
    const movements = buildMovements(
      [line({ type: 'TRANSFER', quantity: '3', location_id: 'l1', to_location_id: 'l2' })],
      ORG
    )
    expect(movements).toHaveLength(2)
    expect(movements[0]).toMatchObject({
      location_id: 'l1',
      quantity: -3,
      movement_type: 'TRANSFER_OUT',
    })
    expect(movements[1]).toMatchObject({
      location_id: 'l2',
      quantity: 3,
      movement_type: 'TRANSFER_IN',
    })
  })

  it('a transfer is balanced — its quantities net to zero', () => {
    const movements = buildMovements(
      [line({ type: 'TRANSFER', quantity: '7', to_location_id: 'l2' })],
      ORG
    )
    const net = movements.reduce((sum, m) => sum + m.quantity, 0)
    expect(net).toBe(0)
  })

  it('skips incomplete lines so they never reach the ledger', () => {
    const movements = buildMovements(
      [line({ quantity: '' }), line({ material_id: '' }), line({ quantity: '2' })],
      ORG
    )
    expect(movements).toHaveLength(1)
  })

  it('keeps user notes but falls back to a default for transfers', () => {
    const withNote = buildMovements([line({ notes: 'spoiled' })], ORG)
    expect(withNote[0].notes).toBe('spoiled')

    const transfer = buildMovements(
      [line({ type: 'TRANSFER', to_location_id: 'l2', notes: '' })],
      ORG
    )
    expect(transfer[0].notes).toBe('Transfer Out')
    expect(transfer[1].notes).toBe('Transfer In')
  })
})

describe('suggestDefaultsForMaterial', () => {
  it('suggests a receipt into the default store when out of stock everywhere', () => {
    expect(suggestDefaultsForMaterial([], 'default-loc')).toEqual({
      type: 'INBOUND',
      locationId: 'default-loc',
    })
  })

  it('auto-selects the only location holding stock for an issue', () => {
    const cells: StockCell[] = [{ material_id: 'm1', location_id: 'l9', quantity: 4 }]
    expect(suggestDefaultsForMaterial(cells, null)).toEqual({
      type: 'OUTBOUND',
      locationId: 'l9',
    })
  })

  it('leaves the source blank when stock is spread across locations', () => {
    const cells: StockCell[] = [
      { material_id: 'm1', location_id: 'l1', quantity: 2 },
      { material_id: 'm1', location_id: 'l2', quantity: 3 },
    ]
    expect(suggestDefaultsForMaterial(cells, null)).toEqual({
      type: 'OUTBOUND',
      locationId: '',
    })
  })
})

describe('buildCountAdjustments', () => {
  const entries = [
    { material_id: 'm1', expected: 10, counted: '8' }, // shortfall of 2
    { material_id: 'm2', expected: 5, counted: '9' }, // surplus of 4
    { material_id: 'm3', expected: 3, counted: '3' }, // no change
    { material_id: 'm4', expected: 1, counted: '' }, // not counted
  ]

  it('emits one signed adjustment per non-zero, counted delta', () => {
    const adj = buildCountAdjustments(entries, 'loc-1', ORG)
    expect(adj).toHaveLength(2)

    const shortfall = adj.find((a) => a.material_id === 'm1')!
    expect(shortfall.quantity).toBe(-2)
    expect(shortfall.movement_type).toBe('ADJUSTMENT_OUT')

    const surplus = adj.find((a) => a.material_id === 'm2')!
    expect(surplus.quantity).toBe(4)
    expect(surplus.movement_type).toBe('ADJUSTMENT_IN')
  })

  it('stamps the location and org on every adjustment', () => {
    const adj = buildCountAdjustments(entries, 'loc-1', ORG)
    expect(adj.every((a) => a.location_id === 'loc-1' && a.organization_id === ORG)).toBe(true)
  })
})
