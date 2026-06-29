import { describe, it, expect } from 'vitest'
import {
  transactionLineSchema,
  collectLineErrors,
  movementInsertSchema,
  materialFormSchema,
} from './schemas'

describe('transactionLineSchema', () => {
  const base = {
    material_id: 'm1',
    location_id: 'l1',
    to_location_id: '',
    quantity: '5',
    type: 'OUTBOUND' as const,
  }

  it('accepts a well-formed issue line', () => {
    expect(transactionLineSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a missing good or location', () => {
    expect(transactionLineSchema.safeParse({ ...base, material_id: '' }).success).toBe(false)
    expect(transactionLineSchema.safeParse({ ...base, location_id: '' }).success).toBe(false)
  })

  it('rejects non-positive or non-numeric quantities', () => {
    expect(transactionLineSchema.safeParse({ ...base, quantity: '0' }).success).toBe(false)
    expect(transactionLineSchema.safeParse({ ...base, quantity: '-3' }).success).toBe(false)
    expect(transactionLineSchema.safeParse({ ...base, quantity: '' }).success).toBe(false)
  })

  it('requires a distinct arrival location for a transfer', () => {
    const sameLoc = { ...base, type: 'TRANSFER' as const, to_location_id: 'l1' }
    const noDest = { ...base, type: 'TRANSFER' as const, to_location_id: '' }
    const valid = { ...base, type: 'TRANSFER' as const, to_location_id: 'l2' }
    expect(transactionLineSchema.safeParse(sameLoc).success).toBe(false)
    expect(transactionLineSchema.safeParse(noDest).success).toBe(false)
    expect(transactionLineSchema.safeParse(valid).success).toBe(true)
  })
})

describe('collectLineErrors', () => {
  it('returns nothing for a clean batch', () => {
    const lines = [
      { id: 1, material_id: 'm1', location_id: 'l1', to_location_id: '', quantity: '2', type: 'OUTBOUND' },
    ]
    expect(collectLineErrors(lines)).toEqual([])
  })

  it('reports the failing line by id', () => {
    const lines = [
      { id: 1, material_id: 'm1', location_id: 'l1', to_location_id: '', quantity: '2', type: 'OUTBOUND' },
      { id: 2, material_id: '', location_id: 'l1', to_location_id: '', quantity: '2', type: 'OUTBOUND' },
    ]
    const errors = collectLineErrors(lines)
    expect(errors).toHaveLength(1)
    expect(errors[0].id).toBe(2)
    expect(errors[0].message).toBeTruthy()
  })
})

describe('movementInsertSchema', () => {
  it('rejects a zero-quantity ledger row', () => {
    const row = {
      organization_id: 'org-1',
      material_id: 'm1',
      location_id: 'l1',
      quantity: 0,
      movement_type: 'INBOUND',
    }
    expect(movementInsertSchema.safeParse(row).success).toBe(false)
  })

  it('accepts every known movement type', () => {
    for (const movement_type of [
      'INBOUND',
      'OUTBOUND',
      'TRANSFER_IN',
      'TRANSFER_OUT',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
    ]) {
      const row = {
        organization_id: 'org-1',
        material_id: 'm1',
        location_id: 'l1',
        quantity: 1,
        movement_type,
      }
      expect(movementInsertSchema.safeParse(row).success).toBe(true)
    }
  })
})

describe('materialFormSchema', () => {
  it('requires a name and coerces numeric strings', () => {
    const parsed = materialFormSchema.parse({
      name: 'Flour',
      reorder_point: '4',
      lot_quantity: '10',
    })
    expect(parsed.reorder_point).toBe(4)
    expect(parsed.lot_quantity).toBe(10)
  })

  it('maps blank optional numbers to null rather than zero', () => {
    const parsed = materialFormSchema.parse({ name: 'Flour', reorder_point: '' })
    expect(parsed.reorder_point).toBeNull()
  })

  it('rejects an empty name and negative numbers', () => {
    expect(materialFormSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(materialFormSchema.safeParse({ name: 'Flour', lot_quantity: '-1' }).success).toBe(false)
  })
})
