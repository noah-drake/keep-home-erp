import { getProductLookup, type CatalogDraft, type NutritionFacts } from '@/lib/integrations/product-lookup'
import { getServiceClient } from '@/utils/supabase-server'
import type { Tables, TablesInsert } from '@/types/database.types'

/**
 * GET /api/catalog/lookup?barcode=XXXX
 *
 * Resolve a scanned barcode to a normalized product draft for the new-good form to prefill.
 *
 * Flow (each catalog step is BEST-EFFORT, so the route is a no-op-safe superset of the old
 * behavior until the shared-catalog migration is applied AND SUPABASE_SERVICE_ROLE_KEY is set):
 *   1. Read-through: if we've already cached this barcode as a GLOBAL catalog_items row, return
 *      it — no external API call (each barcode is fetched once across all Keeps).
 *   2. Otherwise call the provider chain (Open Food Facts -> USDA).
 *   3. Write-through: cache the result as a global catalog_items row (via the service-role
 *      client, which bypasses RLS) so the next scan anywhere is instant.
 *
 * Until the migration/key are in place, getServiceClient() returns null and the catalog steps
 * are skipped — the route simply fetches from the provider and returns the draft, exactly as
 * before.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function rowToDraft(row: Tables<'catalog_items'>): CatalogDraft {
  return {
    barcode: row.barcode ?? '',
    name: row.name,
    brand: null,
    description: row.description,
    categoryTags: [],
    imageUrl: null,
    unit: null,
    nutrition: (row.nutrition as NutritionFacts | null) ?? null,
    source: row.source === 'usda' ? 'usda' : 'openfoodfacts',
    sourceUrl: row.source_url,
    license: row.license === 'CC0' ? 'CC0' : 'ODbL',
    fetchedAt: row.fetched_at ?? new Date(0).toISOString(),
  }
}

/** Look for an already-cached global catalog row. Returns null on any error / when disabled. */
async function readGlobalCatalog(barcode: string): Promise<CatalogDraft | null> {
  const svc = getServiceClient()
  if (!svc) return null
  try {
    const { data, error } = await svc
      .from('catalog_items')
      .select('*')
      .eq('barcode', barcode)
      .eq('visibility', 'global')
      .limit(1)
    if (error || !data?.length) return null
    return rowToDraft(data[0])
  } catch {
    return null // table not migrated yet, etc. — fall through to the provider
  }
}

/** Cache a freshly looked-up draft as a global catalog row. Silent on any failure. */
async function cacheGlobalCatalog(draft: CatalogDraft): Promise<void> {
  const svc = getServiceClient()
  if (!svc || !draft.barcode) return
  try {
    const existing = await svc
      .from('catalog_items')
      .select('id')
      .eq('barcode', draft.barcode)
      .eq('visibility', 'global')
      .limit(1)
    if (existing.data?.length) return // already cached (also guarded by the partial unique index)

    const row: TablesInsert<'catalog_items'> = {
      name: draft.name,
      description: draft.description ?? null,
      barcode: draft.barcode,
      visibility: 'global',
      owner_org_id: null,
      // nutrition column is jsonb (typed as Json); our NutritionFacts shape is valid JSON.
      nutrition: (draft.nutrition ?? null) as TablesInsert<'catalog_items'>['nutrition'],
      source: draft.source,
      source_url: draft.sourceUrl ?? null,
      license: draft.license,
      fetched_at: draft.fetchedAt,
    }
    await svc.from('catalog_items').insert(row)
  } catch (err) {
    console.warn('global catalog cache skipped:', err)
  }
}

export async function GET(request: Request) {
  const barcode = new URL(request.url).searchParams.get('barcode')?.trim()
  if (!barcode) {
    return Response.json({ error: 'barcode query parameter is required' }, { status: 400 })
  }

  try {
    // 1. Read-through cache.
    const cached = await readGlobalCatalog(barcode)
    if (cached) {
      return Response.json({ found: true, cached: true, draft: cached })
    }

    // 2. Provider chain.
    const draft = await getProductLookup().lookup(barcode)
    if (!draft) {
      return Response.json({ found: false }, { status: 404 })
    }

    // 3. Write-through cache (best-effort; never blocks the response on failure).
    await cacheGlobalCatalog(draft)

    return Response.json({ found: true, cached: false, draft })
  } catch (err) {
    console.error('product lookup failed:', err)
    return Response.json({ error: 'product lookup failed' }, { status: 502 })
  }
}
