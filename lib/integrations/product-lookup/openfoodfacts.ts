import type { CatalogDraftInput, ProductLookupProvider } from './types'
import { normalizeProductCasing } from './normalize'

/**
 * Open Food Facts adapter (primary product source).
 * Docs: https://world.openfoodfacts.org/data — API v2 product-by-barcode.
 * License: ODbL (data) — storing + redistributing within the app is permitted WITH
 * attribution ("Data from Open Food Facts (ODbL)"). Product images are separately CC-BY-SA.
 * A descriptive User-Agent is MANDATORY or requests get throttled/blocked. Read limit ~15/min.
 */

const OFF_FIELDS =
  'product_name,brands,categories_tags,image_url,nutriments,quantity,serving_size'

const DEFAULT_USER_AGENT =
  'Keep-Home-ERP/0.1 (+https://github.com/noah-drake/keep-home-erp)'

/** Minimal shape of the fields we read from an OFF v2 product response. */
interface OffResponse {
  status?: number // 1 = found, 0 = not found
  product?: {
    product_name?: string
    brands?: string
    categories_tags?: string[]
    image_url?: string
    quantity?: string
    serving_size?: string
    nutriments?: Record<string, unknown>
  }
}

const finiteNumber = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/**
 * PURE: map an Open Food Facts v2 response into a normalized draft (no `fetchedAt`, no I/O),
 * or null when the product is unknown or has no usable name. Deterministic and unit-tested.
 */
export function mapOpenFoodFactsProduct(
  payload: unknown,
  barcode: string
): CatalogDraftInput | null {
  const body = payload as OffResponse | null
  if (!body || body.status !== 1 || !body.product) return null

  const product = body.product
  const rawName = (product.product_name ?? '').trim()
  if (!rawName) return null

  const name = normalizeProductCasing(rawName)
  const rawBrand = product.brands?.split(',')[0]?.trim() || null
  const brand = rawBrand ? normalizeProductCasing(rawBrand) : null
  const quantity = product.quantity?.trim() || null
  const description = [brand, quantity].filter(Boolean).join(' · ') || null
  const nutriments = product.nutriments ?? {}

  return {
    barcode,
    name,
    brand,
    description,
    categoryTags: product.categories_tags ?? [],
    imageUrl: product.image_url || null,
    unit: quantity || product.serving_size || null,
    nutrition: {
      energyKcal100g: finiteNumber(nutriments['energy-kcal_100g']),
      proteinG100g: finiteNumber(nutriments['proteins_100g']),
      fatG100g: finiteNumber(nutriments['fat_100g']),
      carbsG100g: finiteNumber(nutriments['carbohydrates_100g']),
      servingSize: product.serving_size || null,
      raw: nutriments,
    },
    source: 'openfoodfacts',
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    license: 'ODbL',
  }
}

/** Build an OFF provider. `fetchImpl` is injectable for tests; `now` keeps `fetchedAt` testable. */
export function createOpenFoodFactsProvider(opts?: {
  fetchImpl?: typeof fetch
  userAgent?: string
  now?: () => Date
}): ProductLookupProvider {
  const doFetch = opts?.fetchImpl ?? fetch
  const userAgent = opts?.userAgent ?? process.env.OFF_USER_AGENT ?? DEFAULT_USER_AGENT
  const now = opts?.now ?? (() => new Date())

  return {
    name: 'openfoodfacts',
    async lookup(barcode) {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`
      const res = await doFetch(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      })
      if (!res.ok) return null
      const draft = mapOpenFoodFactsProduct(await res.json(), barcode)
      if (!draft) return null
      return { ...draft, fetchedAt: now().toISOString() }
    },
  }
}
