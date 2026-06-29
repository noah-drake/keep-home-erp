import { z } from 'zod'

/**
 * Provider-agnostic product lookup. An adapter turns one external source's response into a
 * normalized, Zod-validated `CatalogDraft` — no secrets, no Supabase, no DOM — so the mapping
 * logic is unit-testable exactly like the rest of `lib/`. Network + env live in the adapter's
 * `lookup()`, which only ever runs server-side (see app/api/catalog/lookup).
 *
 * Only sources whose license permits storing + redistributing data may produce a CatalogDraft
 * that gets persisted (Open Food Facts = ODbL, USDA FDC = CC0). Sources that forbid retention
 * must never be mapped into this shape.
 */

/** Public, shareable nutrition facts (safe to store on the world-readable global catalog). */
export const nutritionFactsSchema = z.object({
  energyKcal100g: z.number().nullable().optional(),
  proteinG100g: z.number().nullable().optional(),
  fatG100g: z.number().nullable().optional(),
  carbsG100g: z.number().nullable().optional(),
  servingSize: z.string().nullable().optional(),
  /** Original provider nutriment blob, retained verbatim for fidelity / future fields. */
  raw: z.unknown().optional(),
})
export type NutritionFacts = z.infer<typeof nutritionFactsSchema>

/** What an adapter produces BEFORE the lookup wrapper stamps `fetchedAt` (keeps maps pure). */
export const catalogDraftInputSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  categoryTags: z.array(z.string()).default([]),
  imageUrl: z.string().nullable().optional(),
  /** Free-text size/quantity hint (e.g. "500 g"); mapped to a unit on confirm. */
  unit: z.string().nullable().optional(),
  nutrition: nutritionFactsSchema.nullable().optional(),
  source: z.enum(['openfoodfacts', 'usda']),
  sourceUrl: z.string().nullable().optional(),
  license: z.enum(['ODbL', 'CC0']),
})
export type CatalogDraftInput = z.infer<typeof catalogDraftInputSchema>

/** A normalized draft with provenance, ready to prefill a form or upsert into catalog_items. */
export const catalogDraftSchema = catalogDraftInputSchema.extend({
  fetchedAt: z.string(), // ISO-8601, stamped by the lookup wrapper (not the pure mapper)
})
export type CatalogDraft = z.infer<typeof catalogDraftSchema>

/**
 * A single product source. Swappable via the factory in ./index.ts. Future capabilities
 * (MyFitnessPal consumption, receipt OCR) get their own sibling interfaces under
 * lib/integrations/* following this same shape.
 */
export interface ProductLookupProvider {
  readonly name: string
  /** Returns a normalized draft, or null when the barcode is unknown to this source. */
  lookup(barcode: string): Promise<CatalogDraft | null>
}
