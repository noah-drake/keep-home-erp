import type { CatalogDraftInput, ProductLookupProvider } from './types'

/**
 * USDA FoodData Central (Branded Foods) adapter — fallback / nutrition enrichment.
 * License: CC0 (public domain) — no attribution or share-alike required.
 * FDC has NO get-by-barcode endpoint; we search and then verify `gtinUpc` equals the scanned
 * barcode before trusting the match. Requires a free data.gov key in FDC_API_KEY; without it,
 * the provider is a graceful no-op so the chain simply falls through.
 * Docs: https://fdc.nal.usda.gov/api-guide
 */

interface FdcSearchFood {
  fdcId?: number
  description?: string
  brandOwner?: string
  brandName?: string
  gtinUpc?: string
  brandedFoodCategory?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients?: { nutrientName?: string; nutrientNumber?: string; value?: number }[]
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

/**
 * PURE: map a verified FDC Branded food into a normalized draft. The caller MUST have already
 * confirmed `food.gtinUpc === barcode`. Returns null if there's no usable description.
 */
export function mapUsdaFood(food: FdcSearchFood, barcode: string): CatalogDraftInput | null {
  const name = (food.description ?? '').trim()
  if (!name) return null

  const brand = food.brandName?.trim() || food.brandOwner?.trim() || null
  const byNumber = (n: string) =>
    num(food.foodNutrients?.find((x) => x.nutrientNumber === n)?.value)

  return {
    barcode,
    name,
    brand,
    description: brand,
    categoryTags: food.brandedFoodCategory ? [food.brandedFoodCategory] : [],
    imageUrl: null,
    unit:
      food.servingSize && food.servingSizeUnit
        ? `${food.servingSize} ${food.servingSizeUnit}`
        : null,
    nutrition: {
      energyKcal100g: byNumber('208'), // Energy (kcal)
      proteinG100g: byNumber('203'),
      fatG100g: byNumber('204'),
      carbsG100g: byNumber('205'),
      servingSize:
        food.servingSize && food.servingSizeUnit
          ? `${food.servingSize} ${food.servingSizeUnit}`
          : null,
      raw: food.foodNutrients,
    },
    source: 'usda',
    sourceUrl: food.fdcId ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}` : null,
    license: 'CC0',
  }
}

export function createUsdaProvider(opts?: {
  fetchImpl?: typeof fetch
  apiKey?: string
  now?: () => Date
}): ProductLookupProvider {
  const doFetch = opts?.fetchImpl ?? fetch
  const apiKey = opts?.apiKey ?? process.env.FDC_API_KEY
  const now = opts?.now ?? (() => new Date())

  return {
    name: 'usda',
    async lookup(barcode) {
      if (!apiKey) return null // no key configured -> graceful no-op in the chain
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=5&api_key=${apiKey}`
      const res = await doFetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      const json = (await res.json()) as { foods?: FdcSearchFood[] }
      // search != exact lookup: only trust an exact gtinUpc match.
      const match = json.foods?.find((f) => f.gtinUpc?.trim() === barcode)
      if (!match) return null
      const draft = mapUsdaFood(match, barcode)
      if (!draft) return null
      return { ...draft, fetchedAt: now().toISOString() }
    },
  }
}
