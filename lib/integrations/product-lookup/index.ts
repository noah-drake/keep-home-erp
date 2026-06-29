import type { ProductLookupProvider } from './types'
import { createOpenFoodFactsProvider } from './openfoodfacts'
import { createUsdaProvider } from './usda'
import { createChainProvider } from './chain'

export type { CatalogDraft, CatalogDraftInput, NutritionFacts, ProductLookupProvider } from './types'
export { catalogDraftSchema, catalogDraftInputSchema } from './types'
export { mapOpenFoodFactsProduct, createOpenFoodFactsProvider } from './openfoodfacts'
export { mapUsdaFood, createUsdaProvider } from './usda'
export { createChainProvider } from './chain'

/**
 * Resolve the configured product-lookup provider. Swap sources with one env var, no call-site
 * edits — the seam future MFP/receipt integrations follow too.
 *
 *   PRODUCT_LOOKUP_PROVIDER = 'openfoodfacts' | 'usda' | 'chain'   (default: 'chain')
 *
 * 'chain' tries Open Food Facts first (ODbL, broad grocery coverage), then USDA (CC0); USDA is
 * a no-op unless FDC_API_KEY is set, so the default works out of the box with zero config.
 */
export function getProductLookup(): ProductLookupProvider {
  switch (process.env.PRODUCT_LOOKUP_PROVIDER) {
    case 'openfoodfacts':
      return createOpenFoodFactsProvider()
    case 'usda':
      return createUsdaProvider()
    case 'chain':
    default:
      return createChainProvider([createOpenFoodFactsProvider(), createUsdaProvider()])
  }
}
