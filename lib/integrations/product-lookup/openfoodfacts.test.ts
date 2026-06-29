import { describe, it, expect } from 'vitest'
import { mapOpenFoodFactsProduct, createOpenFoodFactsProvider } from './openfoodfacts'
import { catalogDraftSchema } from './types'

const SAMPLE = {
  status: 1,
  product: {
    product_name: 'Creamy Peanut Butter',
    brands: 'Acme, AcmeSub',
    categories_tags: ['en:spreads', 'en:peanut-butters'],
    image_url: 'https://images.openfoodfacts.org/pb.jpg',
    quantity: '500 g',
    serving_size: '32 g',
    nutriments: {
      'energy-kcal_100g': 597,
      'proteins_100g': 25,
      'fat_100g': 50,
      'carbohydrates_100g': 20,
    },
  },
}

describe('mapOpenFoodFactsProduct', () => {
  it('maps a found product into a normalized draft', () => {
    const draft = mapOpenFoodFactsProduct(SAMPLE, '0123456789012')
    expect(draft).toMatchObject({
      barcode: '0123456789012',
      name: 'Creamy Peanut Butter',
      brand: 'Acme', // first brand only
      unit: '500 g',
      source: 'openfoodfacts',
      license: 'ODbL',
      sourceUrl: 'https://world.openfoodfacts.org/product/0123456789012',
    })
    expect(draft?.categoryTags).toContain('en:peanut-butters')
    expect(draft?.nutrition?.energyKcal100g).toBe(597)
    expect(draft?.nutrition?.proteinG100g).toBe(25)
  })

  it('returns null for a not-found response (status 0)', () => {
    expect(mapOpenFoodFactsProduct({ status: 0 }, '000')).toBeNull()
  })

  it('returns null when the product has no usable name', () => {
    expect(
      mapOpenFoodFactsProduct({ status: 1, product: { product_name: '  ' } }, '000')
    ).toBeNull()
  })

  it('coerces missing/non-numeric nutriments to null rather than NaN', () => {
    const draft = mapOpenFoodFactsProduct(
      { status: 1, product: { product_name: 'Plain', nutriments: { 'proteins_100g': 'x' } } },
      '111'
    )
    expect(draft?.nutrition?.proteinG100g).toBeNull()
    expect(draft?.nutrition?.energyKcal100g).toBeNull()
  })
})

describe('createOpenFoodFactsProvider', () => {
  it('fetches, maps, and stamps a deterministic fetchedAt that passes the schema', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(SAMPLE), { status: 200 })) as unknown as typeof fetch
    const provider = createOpenFoodFactsProvider({
      fetchImpl,
      now: () => new Date('2026-06-29T00:00:00.000Z'),
    })
    const draft = await provider.lookup('0123456789012')
    expect(draft?.fetchedAt).toBe('2026-06-29T00:00:00.000Z')
    // The full result must satisfy the persisted-draft contract.
    expect(catalogDraftSchema.safeParse(draft).success).toBe(true)
  })

  it('returns null on a non-200 response', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch
    const provider = createOpenFoodFactsProvider({ fetchImpl })
    expect(await provider.lookup('999')).toBeNull()
  })
})
