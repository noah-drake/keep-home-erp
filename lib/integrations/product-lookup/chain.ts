import type { ProductLookupProvider, CatalogDraft } from './types'

/**
 * Try providers in priority order and return the first hit. A provider that throws (network
 * error, rate limit) is skipped so one flaky source never blocks the rest of the chain.
 */
export function createChainProvider(providers: ProductLookupProvider[]): ProductLookupProvider {
  return {
    name: `chain(${providers.map((p) => p.name).join('>')})`,
    async lookup(barcode): Promise<CatalogDraft | null> {
      for (const provider of providers) {
        try {
          const result = await provider.lookup(barcode)
          if (result) return result
        } catch (err) {
          console.error(`product-lookup provider "${provider.name}" failed:`, err)
        }
      }
      return null
    },
  }
}
