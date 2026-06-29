import { describe, it, expect } from 'vitest'
import { normalizeProductCasing } from './normalize'

describe('normalizeProductCasing', () => {
  it('title-cases all-lowercase open-data names', () => {
    expect(normalizeProductCasing('creamy peanut butter')).toBe('Creamy Peanut Butter')
  })

  it('title-cases ALL-CAPS names', () => {
    expect(normalizeProductCasing('PEANUT BUTTER, CREAMY')).toBe('Peanut Butter, Creamy')
  })

  it('leaves intentionally mixed-case brand names alone', () => {
    expect(normalizeProductCasing('Nutella')).toBe('Nutella')
    expect(normalizeProductCasing('Coca-Cola')).toBe('Coca-Cola')
    expect(normalizeProductCasing('iPhone')).toBe('iPhone')
  })

  it('capitalizes after hyphens and slashes', () => {
    expect(normalizeProductCasing('organic-almonds')).toBe('Organic-Almonds')
    expect(normalizeProductCasing('salt/pepper')).toBe('Salt/Pepper')
  })

  it('handles empty / null safely', () => {
    expect(normalizeProductCasing('')).toBe('')
    expect(normalizeProductCasing(null)).toBe('')
    expect(normalizeProductCasing(undefined)).toBe('')
    expect(normalizeProductCasing('   ')).toBe('')
  })
})
